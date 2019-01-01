import TextDocument from '../vscode/text-document'
import nvimSync from '../neovim/sync-api-client'
import { Watcher } from '../support/utils'
import { URI } from '../vscode/uri'
import nvim from '../neovim/api'
import { basename } from 'path'
import * as vsc from 'vscode'

interface Events {
  didChangeWorkspaceFolders: vsc.WorkspaceFoldersChangeEvent
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
  // TODO: events...
  // TODO: functions...
  onDidChangeWorkspaceFolders: fn => ({ dispose: events.on('didChangeWorkspaceFolders', fn) }),
}

const WorkspaceFolder = (dir: string) => ({
  uri: URI.file(dir),
  name: basename(dir),
  index: 1,
})

export default workspace
