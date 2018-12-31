import { BufferOption, BufferType } from '../neovim/types'
import nvimSync from '../neovim/sync-api-client'
import TextEditor from '../vscode/text-editor'
import Terminal from '../vscode/terminal'
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
    const { bufferId, isTerminal } = nvimSync(async nvim => {
      const currentBuffer = await nvim.current.window.buffer
      return {
        bufferId: currentBuffer.id,
        isTerminal: await currentBuffer.isTerminal(),
      }
    }).call()

    if (isTerminal) return Terminal(bufferId)
  },
  get terminals() {
    const terminalBufferIds = nvimSync(async nvim => {
      const buffers = await nvim.buffers.list()
      const terminalBuffers = await Promise.all(buffers.filter(b => b.isTerminal()))
      return terminalBuffers.map(b => b.id)
    }).call()

    return terminalBufferIds.map(bufid => Terminal(bufid))
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
