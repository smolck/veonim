import filetypeToVSCLanguage from '../langserv/vsc-languages'
import nvimSync from '../neovim/sync-api-client'
import { BufferOption } from '../neovim/types'
// import nvim from '../neovim/api'
import * as vsc from 'vscode'

export default (bufid: number): vsc.TextDocument => ({
  isUntitled: false,
  get uri() {
    const name = nvimSync<string>(async (nvim, id) => {
      return nvim.fromId.buffer(id).name
    }).withArgs(bufid)

    // TODO: need that fancy Uri object here
    return `file://${name}`
  },
  get fileName() {
    return nvimSync<string>(async (nvim, id) => {
      return nvim.fromId.buffer(id).name
    }).withArgs(bufid)
  },
  get languageId() {
    const filetype = nvimSync<string>(async (nvim, id) => {
      return nvim.fromId.buffer(id).getOption(BufferOption.Filetype)
    }).withArgs(bufid)

    return filetypeToVSCLanguage(filetype)
  },
  get version() {
    return nvimSync<number>(async (nvim, id) => {
      return nvim.fromId.buffer(id).changedtick
    }).withArgs(bufid)
  },
  get isDirty() {
    return !!nvimSync<any>(async (nvim, id) => {
      return nvim.fromId.buffer(id).getOption(BufferOption.Modified)
    }).withArgs(bufid)
  },
})
