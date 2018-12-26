import filetypeToVSCLanguage from '../langserv/vsc-languages'
import nvimSync from '../neovim/sync-api-client'
import { BufferOption } from '../neovim/types'
import { is } from '../support/utils'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

// TODO:
// - requestSync with func context works
// - nvim write with bufdo works
// - create TextLine obj
// - create Uri obj
// - write tests

export default (bufid: number): vsc.TextDocument => ({
  get isUntitled() {
    const name = nvimSync<string>(async (nvim, id) => {
      return nvim.fromId.buffer(id).name
    }).withArgs(bufid)

    return !name
  },
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
  get isClosed() {
    // TODO: i'm not sure what the vimscript complement of `nvim_buf_detach_event` is. help?
    return !!nvimSync<any>(async (nvim, id) => {
      return nvim.fromId.buffer(id).getOption(BufferOption.Listed)
    }).withArgs(bufid)
  },
  get lineCount() {
    return nvimSync<number>(async (nvim, id) => {
      return nvim.fromId.buffer(id).length
    }).withArgs(bufid)
  },
  save: () => nvim.fromId.buffer(bufid).write(),
  lineAt: (lineOrPosition: number | vsc.Position) => {
    const line = is.number(lineOrPosition)
      ? lineOrPosition as number
      : (lineOrPosition as vsc.Position).line

    const lineData = nvimSync<string>(async (nvim, id, line) => {
      return nvim.fromId.buffer(id).getLine(line)
    }).withArgs(bufid, line)

    // TODO: return TextLine object
    return lineData
  },
})
