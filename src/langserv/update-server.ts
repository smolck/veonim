import { ProtocolConnection, DidOpenTextDocumentParams, DidChangeTextDocumentParams, WillSaveTextDocumentParams, DidSaveTextDocumentParams, DidCloseTextDocumentParams, TextDocumentSyncKind } from 'vscode-languageserver-protocol'
import { vscLanguageToFiletypes } from '../langserv/vsc-languages'
import TextDocumentManager from '../neovim/text-document-manager'
import FullDocumentManager from '../neovim/full-document-manager'
import { traceLANGSERV as log } from '../support/trace'
import { Buffer } from '../neovim/types'
import nvim from '../neovim/api'

interface LanguageServer extends ProtocolConnection {
  textSyncKind: TextDocumentSyncKind
  untilInitialized: Promise<void>
  pauseTextSync: boolean
}

interface UpdaterParams {
  server: LanguageServer
  languageId: string
  incremental: boolean
  initialBuffer: Buffer
}

const updater = ({ server, languageId, initialBuffer, incremental }: UpdaterParams) => {
  const limitedFiletypes = vscLanguageToFiletypes(languageId)

  const send = (method: string, params: any) => {
    server.sendNotification(`textDocument/${method}`, params)
    log(`NOTIFY --> textDocument/${method}`, params)
  }

  const { on, dispose, manualBindBuffer } = incremental
    ? TextDocumentManager(nvim, limitedFiletypes)
    : FullDocumentManager(nvim, limitedFiletypes)

  manualBindBuffer(initialBuffer)

  on.didOpen(({ uri, version, languageId, text }) => send('didOpen', {
    textDocument: { uri, version, languageId, text },
  } as DidOpenTextDocumentParams))

  on.didChange(({ uri, version, contentChanges }) => {
    if (server.pauseTextSync) return

    send('didChange', {
      textDocument: { uri, version },
      contentChanges,
    } as DidChangeTextDocumentParams)
  })

  on.willSave(({ uri }) => send('willSave', {
    reason: 1,
    textDocument: { uri },
  } as WillSaveTextDocumentParams))

  on.didSave(({ uri }) => send('didSave', {
    textDocument: { uri },
  } as DidSaveTextDocumentParams))

  on.didClose(({ uri }) => send('didClose', {
    textDocument: { uri },
  } as DidCloseTextDocumentParams))

  return { dispose }
}

export default async (server: LanguageServer, languageId: string) => {
  await server.untilInitialized

  const params = { server, languageId, initialBuffer: nvim.current.buffer }

  if (server.textSyncKind === TextDocumentSyncKind.Incremental) {
    return updater(Object.assign(params, { incremental: true }))
  }

  if (server.textSyncKind === TextDocumentSyncKind.Full) {
    console.warn(`Warning: Language server for ${languageId} does not support incremental text synchronization. This is a negative performance impact - especially on large files.`)
    return updater(Object.assign(params, { incremental: false }))
  }

  return { dispose: () => {} }
}
