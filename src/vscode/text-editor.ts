import { Position, Range, Selection } from '../vscode/types'
import TextDocument from '../vscode/text-document'
import nvimSync from '../neovim/sync-api-client'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

export default (winid: number): vsc.TextEditor => ({
  get document() {
    const bufid = nvimSync(async (nvim, id) => {
      const buf = await nvim.Window(id).buffer
      return buf.id
    }).call(winid)

    return TextDocument(bufid)
  },
  // this only works for the current active window
  get selection() {
    const { start, end } = nvimSync(async (nvim) => {
      const [ start, end ] = await Promise.all([
        nvim.call.getpos(`'<`),
        nvim.call.getpos(`'>`),
      ])
      return { start, end }
    }).call()

    const [ /*bufnum*/, startLine, startCol ] = start
    const [ /*bufnum*/, endLine, endCol ] = end

    const isVisualLineMode = startCol === 0

    const anchor = new Position(startLine, isVisualLineMode ? 0 : startCol - 1)
    const active = isVisualLineMode
      ? new Position(endLine + 1, 0)
      : new Position(endLine, endCol - 1)

    return new Selection(anchor, active)
  },
  // nvim does not support multiple selections, but we should classify visual
  // block mode as multiple selections. (also only work for current window)
  // TODO: how to determine visual block mode and breakup selections
  get selections() {
    const { start, end } = nvimSync(async (nvim) => {
      const [ start, end ] = await Promise.all([
        nvim.call.getpos(`'<`),
        nvim.call.getpos(`'>`),
      ])
      return { start, end }
    }).call()

    const [ /*bufnum*/, startLine, startCol ] = start
    const [ /*bufnum*/, endLine, endCol ] = end

    const isVisualLineMode = startCol === 0

    const anchor = new Position(startLine, isVisualLineMode ? 0 : startCol - 1)
    const active = isVisualLineMode
      ? new Position(endLine + 1, 0)
      : new Position(endLine, endCol - 1)

    return [ new Selection(anchor, active) ]
  },
  // this only works for the current active window
  get visibleRanges() {
    const top = new Position(nvim.state.editorTopLine, 0)
    const bottom = new Position(nvim.state.editorBottomLine + 1, 0)
    return new Range(top, bottom)
  },
})
