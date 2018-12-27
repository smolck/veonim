import TextDocument from '../vscode/text-document'
import nvimSync from '../neovim/sync-api-client'
import nvim from '../neovim/api'
import { basename } from 'path'
// import * as vsc from 'vscode'

// const workspace: typeof vsc.workspace = {
const workspace: any = {
  get rootPath() { return nvim.state.cwd },
  get workspaceFolders() { return [ nvim.state.cwd ] },
  get name() { return basename(nvim.state.cwd) },
  get textDocuments() {
    const buffers = nvimSync(nvim => nvim.buffers.list()).call()
    const bufferIds = buffers.map(b => b.id)
    return bufferIds.map(id => TextDocument(id))
  },
  // TODO: events...
  // TODO: functions...
}

export default workspace
