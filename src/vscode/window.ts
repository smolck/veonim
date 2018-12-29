import TextEditor from '../vscode/text-editor'
import nvimSync from '../neovim/sync-api-client'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

const window: typeof vsc.window = {
  get activeTextEditor() {
    return TextEditor(nvim.current.window.id)
  },
  get visibleTextEditors() {
    // while we could query all current windows in the tabpage, we can't
    // perform all necessary buffer operations on inactive windows.
    // for example, visual selections in nvim are not preserved when
    // switching windows. in vscode that is indeed possible.
    // so for now, we will only return the current active window
    return TextEditor(nvim.current.window.id)
  },
  get activeTerminal() {
    console.warn('NYI: window.activeTerminal')
  },
  get terminals() {
    console.warn('NYI: window.terminals')
  },
  get state() {
    console.warn('NYI: window.state')
  },
  onDidChangeActiveTextEditor: fn => {

  },
}

export default window
