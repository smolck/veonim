import { showMessage, showStatusBarMessage, showProgressMessage } from '../extension-host/bridge-api'
import OutputChannel from '../vscode/output-channel'
import { is, Watcher, uuid } from '../support/utils'
import { StatusBarAlignment } from '../vscode/types'
import { MessageKind } from '../protocols/veonim'
import { makeCancelToken } from '../vscode/tools'
import nvimSync from '../neovim/sync-api-client'
import TextEditor from '../vscode/text-editor'
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
  actions: string[]
}

// (message: string, ...items: string[])
// (message: string, ...items: { title: string }[])
// (message: string, options: {}, ...items: { title: string }[])
const unifyMessage = ([ message, ...stuff ]: any[]): UnifiedMessage => {
  const [ firstItem, ...restOfItems ] = stuff || [] as any[]
  const isModal: boolean = is.object(firstItem) ? <any>firstItem.modal : false
  const items: string[] = is.object(firstItem) ? restOfItems : stuff
  const actions: string[] = items.map((item: any) => item.title || item)
  return { message, isModal, actions }
}

const makeStatusBarItem = (alignment = StatusBarAlignment.Left, priority = 0): vsc.StatusBarItem => {
  let text = ''
  let tooltip: string | undefined
  let color: string | vsc.ThemeColor | undefined
  let command: string | undefined

  const api: vsc.StatusBarItem = {
    get alignment() { return alignment },
    get priority() { return priority },
    get text() { return text },
    set text(m) { text = m },
    get tooltip() { return tooltip },
    set tooltip(m) { tooltip = m },
    get color() { return color },
    set color(m) { color = m },
    get command() { return command },
    set command(m) { command = m },
    // TODO: hookup to UI
    show: () => console.warn('NYI: StatusBarItem.show()', api),
    // TODO: is hide supposed to also call dispose()? the typings docs
    // say something about that but it is ambigious. should check src
    hide: () => console.warn('NYI: StatusBarItem.hide()', api),
    dispose: () => console.warn('NYI: StatusBarItem.dispose()', api),
  }

  return api
}

const events = Watcher<Events>()

const eventreg = (name: keyof Events) => (fn: any, thisArg?: any) => ({
  dispose: events.on(name, fn.bind(thisArg)),
})

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
  showInformationMessage: async (...a: any[]) => {
    const { message, actions } = unifyMessage(a)
    const { promise } = await showMessage({ message, kind: MessageKind.Info, actions })
    return promise
  },
  showWarningMessage: async (...a: any[]) => {
    const { message, actions } = unifyMessage(a)
    const { promise } = await showMessage({ message, kind: MessageKind.Warning, actions })
    return promise
  },
  showErrorMessage: async (...a: any[]) => {
    const { message, actions } = unifyMessage(a)
    const { promise } = await showMessage({ message, kind: MessageKind.Error, actions })
    return promise
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
  showInputBox: (options = {}) => {
    // TODO: support more options and cancel token with a custom input
    // prompt instead of the nvim built-in one. i think we can still leverage
    // the nvim input, we just need to signal the UI some additional properties
    // for the next cmdline event update
    return nvim.call.input(options.prompt, options.value)
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
  createOutputChannel: name => OutputChannel(name),
  // @ts-ignore
  createWebviewPanel: () => {
    console.warn('NYI: window.createWebviewPanel')
  },
  setStatusBarMessage: (text: string, timeoutOrThenable?: any) => {
    showStatusBarMessage(text)
    // TODO: this is a really bad way of doing this because we could be overriding
    // other messages possibly presented by nvim
    if (is.number(timeoutOrThenable)) {
      setTimeout(() => showStatusBarMessage(''), timeoutOrThenable as number)
    }
    if (is.promise(timeoutOrThenable)) {
      (timeoutOrThenable as Promise<any>).then(() => showStatusBarMessage(''))
    }
    return { dispose: () => showStatusBarMessage('') }
  },
  // @ts-ignore
  withScmProgress: () => {
    console.warn('NYI: window.withScmProgress')
  },
  withProgress: async (options, task) => {
    const token = makeCancelToken(uuid())

    if (options.location !== 15) {
      console.warn('NYI: withProgress - not supported non ProgressLocation.Notification', options)
      const progress = {
        report: (_: any) => {},
      }
      return task(progress, token.token)
    }

    // TODO: support ProgressLocation.Window (status bar)
    // TODO: support ProgressLocation.SourceControl
    const msg = await showProgressMessage({
      message: options.title || '',
      kind: MessageKind.Progress,
      progressCancellable: options.cancellable,
    })

    msg.promise.then(token.cancel)

    const progress = {
      report: (update: { message?: string, increment?: number }) => msg.setProgress({
        status: update.message,
        percentage: update.increment,
      }),
    }

    return task(progress, token.token)
  },
  createStatusBarItem: makeStatusBarItem,
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
  onDidChangeWindowState: eventreg('didChangeWindowState'),
  onDidChangeActiveTextEditor: eventreg('didChangeActiveTextEditor'),
  onDidChangeVisibleTextEditors: eventreg('didChangeVisibleTextEditors'),

  onDidChangeTextEditorSelection: eventreg('didChangeTextEditorSelection'),
  onDidChangeTextEditorVisibleRanges: eventreg('didChangeTextEditorVisibleRanges'),
  onDidChangeTextEditorOptions: eventreg('didChangeTextEditorOptions'),
  onDidChangeTextEditorViewColumn: eventreg('didChangeTextEditorViewColumn'),
  onDidChangeActiveTerminal: eventreg('didChangeActiveTerminal'),
  onDidOpenTerminal: eventreg('didOpenTerminal'),
  onDidCloseTerminal: eventreg('didCloseTerminal'),
}

export default window
