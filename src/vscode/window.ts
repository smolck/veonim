import { call } from '../messaging/worker-client'
import { NotifyKind } from '../protocols/veonim'
import nvimSync from '../neovim/sync-api-client'
import TextEditor from '../vscode/text-editor'
import { is, Watcher } from '../support/utils'
import Terminal from '../vscode/terminal'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

interface Events {
  didChangeWindowState: vsc.WindowState
  didChangeActiveTextEditor: vsc.TextEditor | undefined
  didChangeVisibleTextEditors: vsc.TextEditor[]
  didChangeTextEditorSelection: vsc.TextEditorSelectionChangeEvent
  didChangeTextEditorVisibleRanges: vsc.TextEditorVisibleRangesChangeEvent
  didChangeTextEditorOptions: vsc.TextEditorOptionsChangeEvent
  didChangeTextEditorViewColumn: vsc.TextEditorViewColumnChangeEvent
  didChangeActiveTerminal: vsc.Terminal | undefined
  didOpenTerminal: vsc.Terminal
  didCloseTerminal: vsc.Terminal
}

interface UnifiedMessage {
  message: string
  isModal: boolean
  actionItems: string[]
}

const unifyMessage = ([ message, optionsOrItems, itemsMaybe ]: any[]): UnifiedMessage => {
  const isModal: boolean = is.object(optionsOrItems) ? <any>optionsOrItems.modal : false
  const items: string[] = is.array(optionsOrItems) ? optionsOrItems : itemsMaybe
  const actionItems: string[] = items.map((item: any) => item.title || item)
  return { message, isModal, actionItems }
}

const events = Watcher<Events>()

// TODO: actually implement and call event handlers when stuff happens

// @ts-ignore
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
  // TODO: maybe we can use nvim inputlist() for this?
  // TODO: we need to return the selected dialog button action item thingy value
  showInformationMessage: async (...a: any[]) => {
    const { message, actionItems } = unifyMessage(a)
    call.notify(message, NotifyKind.Info, actionItems)
    return Promise.resolve(undefined)
  },
  showWarningMessage: async (...a: any[]) => {
    const { message, actionItems } = unifyMessage(a)
    call.notify(message, NotifyKind.Info, actionItems)
    return Promise.resolve(undefined)
  },
  showErrorMessage: async (...a: any[]) => {
    const { message, actionItems } = unifyMessage(a)
    call.notify(message, NotifyKind.Info, actionItems)
    return Promise.resolve(undefined)
  },
  showQuickPick: () => {
    console.warn('NYI: window.showQuickPick')
    return Promise.resolve(undefined)
  },
  showWorkspaceFolderPick: () => {
    console.warn('NYI: window.showWorkspaceFolderPick')
    return Promise.resolve(undefined)
  },
  showOpenDialog: () => {
    console.warn('NYI: window.showOpenDialog')
    return Promise.resolve(undefined)
  },
  showSaveDialog: () => {
    console.warn('NYI: window.showSaveDialog')
    return Promise.resolve(undefined)
  },
  showInputBox: () => {
    console.warn('NYI: window.showInputBox')
    return Promise.resolve(undefined)
  },
  // @ts-ignore
  createInputBox: () => {
    console.warn('NYI: window.createInputBox')
  },
  // @ts-ignore
  createTextEditorDecorationType: () => {
    console.warn('NYI: window.createTextEditorDecorationType')
  },
  // @ts-ignore
  createQuickPick: () => {
    console.warn('NYI: window.createQuickPick')
  },
  // @ts-ignore
  createOutputChannel: () => {
    console.warn('NYI: window.createOutputChannel')
  },
  // @ts-ignore
  createWebviewPanel: () => {
    console.warn('NYI: window.createWebviewPanel')
  },
  setStatusBarMessage: (text: string) => {
    console.log('vsc-ext-api (StatusBarMessage):', text)
    return { dispose: () => {} }
  },
  // @ts-ignore
  withScmProgress: () => {
    console.warn('NYI: window.withScmProgress')
  },
  // @ts-ignore
  withProgress: () => {
    console.warn('NYI: window.withProgress')
  },
  // @ts-ignore
  createStatusBarItem: () => {
    console.warn('NYI: window.createStatusBarItem')
  },
  // @ts-ignore
  createTerminal: () => {
    // TODO: this is easy to do, but where do we show the new term buffer?
    console.warn('NYI: window.createTerminal')
  },
  // @ts-ignore
  registerTreeDataProvider: () => {
    console.warn('NYI: window.registerTreeDataProvider')
  },
  // @ts-ignore
  createTreeView: () => {
    console.warn('NYI: window.createTreeView')
  },
  // @ts-ignore
  registerUriHandler: () => {
    console.warn('NYI: window.registerUriHandler')
  },
  // @ts-ignore
  registerWebviewPanelSerializer: () => {
    console.warn('NYI: window.registerWebviewPanelSerializer')
  },
  // TODO: get the argument types here
  // @ts-ignore
  showTextDocument: async (documentOrUri: any, optionsOrColumn: any) => {
    console.warn('NYI: window.showTextDocument', documentOrUri, optionsOrColumn)
    return TextEditor(-1)
  },
  onDidChangeWindowState: fn => registerEvent('didChangeWindowState', fn),
  onDidChangeActiveTextEditor: fn => registerEvent('didChangeActiveTextEditor', fn),
  onDidChangeVisibleTextEditors: fn => registerEvent('didChangeVisibleTextEditors', fn),

  onDidChangeTextEditorSelection: fn => registerEvent('didChangeTextEditorSelection', fn),
  onDidChangeTextEditorVisibleRanges: fn => registerEvent('didChangeTextEditorVisibleRanges', fn),
  onDidChangeTextEditorOptions: fn => registerEvent('didChangeTextEditorOptions', fn),
  onDidChangeTextEditorViewColumn: fn => registerEvent('didChangeTextEditorViewColumn', fn),
  onDidChangeActiveTerminal: fn => registerEvent('didChangeActiveTerminal', fn),
  onDidOpenTerminal: fn => registerEvent('didOpenTerminal', fn),
  onDidCloseTerminal: fn => registerEvent('didCloseTerminal', fn),
}

const registerEvent = (name: keyof Events, fn: any) => ({ dispose: events.on(name, fn) })

export default window
