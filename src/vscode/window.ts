import TextEditor from '../vscode/text-editor'
import { is } from '../support/utils'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

const window: typeof vsc.window = {
  get state() {
    // TODO: uhh what does this mean? the app is focused?
    // should we switch this to false when the current nvim
    // instance is not active in veonim?
    return { focused: true }
  },
  get activeTextEditor() {
    return TextEditor(nvim.current.window.id)
  },
  get visibleTextEditors() {
    // while we could query all current windows in the tabpage, we can't
    // perform all necessary buffer operations on inactive windows.
    // for example, visual selections in nvim are not preserved when
    // switching windows. in vscode that is indeed possible.
    // so for now, we will only return the current active window
    return [ TextEditor(nvim.current.window.id) ]
  },
  get activeTerminal() {
    console.warn('NYI: window.activeTerminal')
    return {}
  },
  get terminals() {
    console.warn('NYI: window.terminals')
    return []
  },
  onDidChangeActiveTextEditor: fn => {
    console.warn('NYI: window.onDidChangeActiveTextEditor', fn)
  },
  showInformationMessage: (message: string, optionsOrItems: string[] | any, itemsMaybe?: string[]) => {
    const isModal: boolean = is.object(optionsOrItems) ? <any>optionsOrItems.modal : false
    const items: string[] = is.array(optionsOrItems) ? optionsOrItems : itemsMaybe
    const actionItems: string[] = items.map((item: any) => item.title || item)
  },
}

export default window
