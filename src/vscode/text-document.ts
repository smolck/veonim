import nvimSync from '../neovim/sync-api-client'
// import nvim from '../neovim/api'
import * as vsc from 'vscode'

export default (bufid: number): vsc.TextDocument => ({
  isUntitled: false,
  get uri() {
    const name = nvimSync<string>(async (nvim, id) => {
      return nvim.fromId.buffer(id).name
    }).withArgs(bufid)

    // TOOD: need that fancy Uri object here
    return `file://${name}`
  },
  get fileName() {
    return nvimSync<string>(async (nvim, id) => {
      return nvim.fromId.buffer(id).name
    }).withArgs(bufid)
  }
})