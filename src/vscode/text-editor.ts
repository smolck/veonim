import TextDocument from '../vscode/text-document'
import { Position, Range } from '../vscode/types'
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
  get selection() {

  },
  get selections() {

  },
  // TODO: this only works for the current active window
  get visibleRanges() {
    const top = new Position(nvim.state.editorTopLine, 0)
    const bottom = new Position(nvim.state.editorBottomLine + 1, 0)
    return new Range(top, bottom)
  },
})
