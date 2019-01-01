import TextDocument from '../vscode/text-document'
import nvimSync from '../neovim/sync-api-client'
import { Watcher } from '../support/utils'
import { URI } from '../vscode/uri'
import nvim from '../neovim/api'
import { basename } from 'path'
import * as vsc from 'vscode'

interface Events {
  didChangeWorkspaceFolders: vsc.WorkspaceFoldersChangeEvent
  didOpenTextDocument: vsc.TextDocument
  didCloseTextDocument: vsc.TextDocument
  didChangeTextDocument: vsc.TextDocumentChangeEvent
  willSaveTextDocument: vsc.TextDocumentWillSaveEvent
  didSaveTextDocument: vsc.TextDocument
  didChangeConfiguration: vsc.ConfigurationChangeEvent
}

const events = Watcher<Events>()

nvim.watchState.cwd((cwd, previousCwd) => events.emit('didChangeWorkspaceFolders', {
  added: [ WorkspaceFolder(cwd) ],
  removed: [ WorkspaceFolder(previousCwd) ],
}))

const workspace: typeof vsc.workspace = {
// const workspace: any = {
  get rootPath() { return nvim.state.cwd },
  get workspaceFolders() { return [ WorkspaceFolder(nvim.state.cwd) ] },
  get name() { return basename(nvim.state.cwd) },
  get textDocuments() {
    const buffers = nvimSync(nvim => nvim.buffers.list()).call()
    const bufferIds = buffers.map(b => b.id)
    return bufferIds.map(id => TextDocument(id))
  },
  onDidChangeWorkspaceFolders: fn => registerEvent('didChangeWorkspaceFolders', fn),
  onDidOpenTextDocument: fn => registerEvent('didOpenTextDocument', fn),
  onDidCloseTextDocument: fn => registerEvent('didCloseTextDocument', fn),
  onDidChangeTextDocument: fn => registerEvent('didChangeTextDocument', fn),
  onWillSaveTextDocument: fn => registerEvent('willSaveTextDocument', fn),
  onDidSaveTextDocument: fn => registerEvent('didSaveTextDocument', fn),
  onDidChangeConfiguration: fn => registerEvent('didChangeConfiguration', fn),
}

const registerEvent = (name: keyof Events, fn: any) => ({ dispose: events.on(name, fn) })

const WorkspaceFolder = (dir: string) => ({
  uri: URI.file(dir),
  name: basename(dir),
  index: 1,
})

export default workspace
