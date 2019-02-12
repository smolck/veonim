import WorkspaceConfiguration from '../vscode/workspace-configuration'
import TextDocumentManager from '../neovim/text-document-manager'
import { Watcher, pathRelativeToCwd, is } from '../support/utils'
import TextDocument from '../vscode/text-document'
import nvimSync from '../neovim/sync-api-client'
import { on } from '../messaging/worker-client'
import { URI } from '../vscode/uri'
import Tasks from '../vscode/tasks'
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
  // TODO: no didChangeConfig emitters yet
  didChangeConfiguration: vsc.ConfigurationChangeEvent
}

const events = Watcher<Events>()
const tdm = TextDocumentManager(nvim)

const state = {
  textSyncEnabled: true,
}

on.set_text_sync_state((enabled: boolean) => state.textSyncEnabled = enabled)

nvim.watchState.cwd((cwd, previousCwd) => events.emit('didChangeWorkspaceFolders', {
  added: [ WorkspaceFolder(cwd) ],
  removed: [ WorkspaceFolder(previousCwd) ],
}))

tdm.on.didOpen(({ id }) => events.emit('didOpenTextDocument', TextDocument(id)))

tdm.on.didChange(({ id, contentChanges }) => state.textSyncEnabled && events.emit('didChangeTextDocument', {
  contentChanges,
  document: TextDocument(id),
} as vsc.TextDocumentChangeEvent))

tdm.on.willSave(({ id }) => events.emit('willSaveTextDocument', {
  document: TextDocument(id),
  reason: 1, // TextDocumentSaveReason.Manual
  waitUntil: () => console.warn('willSave event waitUntil() not supported'),
} as vsc.TextDocumentWillSaveEvent))

tdm.on.didSave(({ id }) => events.emit('didSaveTextDocument', TextDocument(id)))

tdm.on.didClose(({ id }) => events.emit('didCloseTextDocument', TextDocument(id)))

const workspace: typeof vsc.workspace = {
  get rootPath() { return nvim.state.cwd },
  get workspaceFolders() { return [ WorkspaceFolder(nvim.state.cwd) ] },
  get name() { return basename(nvim.state.cwd) },
  get textDocuments() {
    const buffers = nvimSync(nvim => nvim.buffers.list()).call()
    const bufferIds = buffers.map(b => b.id)
    return bufferIds.map(id => TextDocument(id))
  },
  getWorkspaceFolder: uri => {
    if (!uri.path.startsWith(nvim.state.cwd)) {
      console.error('given uri is not part of cwd', uri.path, nvim.state.cwd)
      return undefined
    }
    return WorkspaceFolder(nvim.state.cwd)
  },
  asRelativePath: pathOrUri => {
    const path = pathOrUri instanceof URI ? pathOrUri.path : pathOrUri as string
    return pathRelativeToCwd(path, nvim.state.cwd)
  },
  updateWorkspaceFolders: (_start, _deleteCount, folder) => {
    nvim.cmd(`cd ${folder.uri.path}`)
    return true
  },
  createFileSystemWatcher: () => {
    console.warn('NYI: workspace.createFileSystemWatcher')
    return new Proxy(Object.create(null), {
      get: (_: any, __: string) => () => {},
    }) as any
  },
  // TODO: nvim does not provide a save buffers in background option yet
  saveAll: () => Promise.resolve(false),
  findFiles: async () => {
    // TODO: vscode has a glob module built-in. we have it in veonim src
    console.warn('NYI: workspace.findFiles')
    return []
  },
  applyEdit: async (workspaceEdit) => {
    const edits = [...workspaceEdit.entries()]
    const editRequests = edits.map(async ([ uri, textEdits ]) => {
      // TODO: double check this arguments. according to WorkspaceEdit the edits are an array of objects? but what does entries() return? 
      const buffer = await nvim.buffers.getBufferFromPath(uri.path)

      // TODO: need to handle file operations (create, rename, delete)
      textEdits.forEach(async ({ range, newText }) => {
        // TODO: is newText insert or append? in the docs newText is described as "INSERT"
        // but then how are replace edits applied? should check source...
        buffer.replaceRange(range.start.line, range.start.character, range.end.line, range.end.character, newText)
      })
    })

    return await Promise.all(editRequests).then(() => true, () => false)
  },
  openTextDocument: async (arg: any) => {
    if (is.object(arg) && arg.path) {
      const buffer = await nvim.buffers.add((arg as vsc.Uri).path)
      return TextDocument(buffer.id)
    }

    if (is.string(arg)) {
      const buffer = await nvim.buffers.add(arg as string)
      return TextDocument(buffer.id)
    }

    const buffer = await nvim.buffers.create(arg)
    return TextDocument(buffer.id)
  },
  registerTextDocumentContentProvider: () => {
    console.warn('NYI: workspace.registerTextDocumentContentProvider')
    return ({ dispose: () => {} })
  },
  // TODO: i'm not sure what the resource is used for?
  getConfiguration: (section, resource) => {
    // TODO: we should load configuration (somewhere) provided in package.json
    if (resource) console.warn('NYI: workspace.getConfiguration - resource param not used:', resource)
    return WorkspaceConfiguration(section)
  },
  registerTaskProvider: (...a: any[]) => {
    console.warn('DEPRECATED: workspace.registerTaskProvider. use the "tasks" namespace instead')
    // @ts-ignore - help me typescript you're my only hope
    return Tasks.registerTaskProvider(...a as any)
  },
  registerFileSystemProvider: () => {
    console.warn('NYI: workspace.registerFileSystemProvider')
    return ({ dispose: () => {} })
  },
  onDidChangeWorkspaceFolders: (fn, thisArg) => registerEvent('didChangeWorkspaceFolders', fn, thisArg),
  onDidOpenTextDocument: (fn, thisArg) => registerEvent('didOpenTextDocument', fn, thisArg),
  onDidCloseTextDocument: (fn, thisArg) => registerEvent('didCloseTextDocument', fn, thisArg),
  onDidChangeTextDocument: (fn, thisArg) => registerEvent('didChangeTextDocument', fn, thisArg),
  onWillSaveTextDocument: (fn, thisArg) => registerEvent('willSaveTextDocument', fn, thisArg),
  onDidSaveTextDocument: (fn, thisArg) => registerEvent('didSaveTextDocument', fn, thisArg),
  onDidChangeConfiguration: (fn, thisArg) => registerEvent('didChangeConfiguration', fn, thisArg),
}

const registerEvent = (name: keyof Events, fn: any, thisArg?: any) => ({
  dispose: events.on(name, fn.bind(thisArg)),
})

const WorkspaceFolder = (dir: string) => ({
  uri: URI.file(dir),
  name: basename(dir),
  index: 1,
})

export default workspace
