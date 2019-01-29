import { getActiveInstance, onSwitchVim, onCreateVim, instances } from '../core/instance-manager'
import { VimMode, BufferInfo, HyperspaceCoordinates } from '../neovim/types'
import { CompletionItem, Command } from 'vscode-languageserver-protocol'
import { onFnCall, pascalCase } from '../support/utils'
import { colors } from '../render/highlight-attributes'
import { Functions } from '../neovim/function-types'
import { WindowMetadata } from '../windows/metadata'
import * as dispatch from '../messaging/dispatch'
import { NotifyKind } from '../protocols/veonim'
import { Symbol } from '../langserv/adapter'
import { GitStatus } from '../support/git'
import NeovimState from '../neovim/state'
import { AIClient } from '../ai/protocol'
import { EventEmitter } from 'events'
import { clipboard } from 'electron'

const ee = new EventEmitter()
const { state, watchState, onStateValue, onStateChange, untilStateValue } = NeovimState('nvim-mirror')
const actionRegistrations: string[] = []

onCreateVim(info => {
  const isActive = () => info.id && instances.current
  const instance = getActiveInstance()

  if (actionRegistrations.length) actionRegistrations.forEach(name => instance.call.onAction(name))

  instance.on.nvimStateUpdate((stateDiff: any) => {
    if (info.id !== instances.current) return
    // TODO: do we need this to always be updated or can we query these values?
    // this will trigger on every cursor move and take up time in the render cycle
    Object.assign(state, stateDiff)
  })

  instance.on.notify((msg: string, kind: NotifyKind, actions?: string[]) => isActive() && dispatch.pub('notify', { msg, kind, actions }))
  instance.on.vimrcLoaded(() => isActive() && ee.emit('nvim.load', false))
  instance.on.gitStatus((status: GitStatus) => isActive() && ee.emit('git.status', status))
  instance.on.gitBranch((branch: string) => isActive() && ee.emit('git.branch', branch))
  instance.on.actionCalled((name: string, args: any[]) => isActive() && ee.emit(`action.${name}`, ...args))
  instance.on.ai((namespace: string, method: string, args: any[]) => {
    isActive() && ee.emit(`ai.${namespace}.on${pascalCase(method)}`, ...args)
  })

  instance.on.getDefaultColors(async () => ({
    background: colors.background,
    foreground: colors.foreground,
    special: colors.special,
  }))

  instance.on.getCursorPosition(async () => {
    const { cursor: { row, col } } = require('../core/cursor')
    return { row, col }
  })

  instance.on.clipboardRead(async () => clipboard.readText())
  instance.on.clipboardWrite((text: string) => clipboard.writeText(text))
})

onSwitchVim(async () => {
  const instance = getActiveInstance()

  const [ nextState, gitInfo ] = await Promise.all([
    instance.request.getState(),
    instance.request.getGitInfo(),
  ])

  Object.assign(state, nextState)
  ee.emit('git.status', gitInfo.status)
  ee.emit('git.branch', gitInfo.branch)
  ee.emit('nvim.load', true)
})

const getBufferInfo = (): Promise<BufferInfo[]> => getActiveInstance().request.getBufferInfo()

const setMode = (mode: VimMode) => {
  Object.assign(state, { mode })
  getActiveInstance().call.setNvimMode(mode)
}

const getWindowMetadata = async (): Promise<WindowMetadata[]> => {
  return getActiveInstance().request.getWindowMetadata()
}

const onAction = (name: string, fn: (...args: any[]) => void) => {
  if (typeof fn !== 'function') throw new Error(`nvim.onAction needs a function for event ${name}`)
  actionRegistrations.push(name)
  ee.on(`action.${name}`, fn)
  try {
    getActiveInstance().call.onAction(name)
  } catch (_) {
    // not worried if no instance, we will register later in 'onCreateVim'
  }
}

const git = {
  onStatus: (fn: (status: GitStatus) =>  void) => ee.on('git.status', fn),
  onBranch: (fn: (branch: string) => void) => ee.on('git.branch', fn),
}

const bufferSearch = (file: string, query: string) => getActiveInstance().request.bufferSearch(file, query)
const bufferSearchVisible = (query: string) => getActiveInstance().request.bufferSearchVisible(query)

const nvimLoaded = (fn: (switchInstance: boolean) => void) => ee.on('nvim.load', fn)
const nvimGetVar = (key: string) => getActiveInstance().request.nvimGetVar(key)
const nvimCommand = (command: string) => getActiveInstance().call.nvimCommand(command)
const nvimFeedkeys = (keys: string, mode = 'm') => getActiveInstance().call.nvimFeedkeys(keys, mode)
const nvimExpr = (expr: string) => getActiveInstance().request.nvimExpr(expr)
const nvimCall: Functions = onFnCall((name, a) => getActiveInstance().request.nvimCall(name, a))
const nvimJumpTo = (coords: HyperspaceCoordinates) => getActiveInstance().call.nvimJumpTo(coords)
const nvimJumpToProjectFile = (coords: HyperspaceCoordinates) => getActiveInstance().call.nvimJumpToProjectFile(coords)
const nvimGetKeymap = () => getActiveInstance().request.nvimGetKeymap()
const nvimGetColorByName = (name: string) => getActiveInstance().request.nvimGetColorByName(name)
const nvimSaveCursor = async () => {
  const instance = getActiveInstance()
  const position = await instance.request.nvimSaveCursor()
  return () => instance.call.nvimRestoreCursor(position)
}

const nvimHighlightSearchPattern = async (pattern: string, id?: number): Promise<number> => {
  return getActiveInstance().request.nvimHighlightSearchPattern(pattern, id)
}

const nvimRemoveHighlightSearch = async (id: number, pattern?: string): Promise<boolean> => {
  return getActiveInstance().request.nvimRemoveHighlightSearch(id, pattern)
}

const manualAI = {
  completions: {
    getDetail: (item: CompletionItem): Promise<CompletionItem> => {
      return getActiveInstance().request.aiGetCompletionDetail(item)
    },
  },
  symbols: {
    getWorkspaceSymbols: (query: string): Promise<Symbol[]> => {
      return getActiveInstance().request.aiGetWorkspaceSymbols(query)
    },
  },
  codeAction: {
    run: (action: Command) => getActiveInstance().call.aiRunCodeAction(action),
  }
}

type AIAPI = AIClient & typeof manualAI

const ai: AIAPI = new Proxy(Object.create(null), {
  get: (_: any, namespace: string) => new Proxy(Object.create(null), {
    get: (_: any, method: string) => (...args: any[]) => {
      const res = Reflect.get(manualAI, namespace)
      const manualFn = res && Reflect.get(res, method)
      if (manualFn) return manualFn(...args)
      ee.on(`ai.${namespace}.${method}`, args[0])
    }
  })
})

const api = {
  ai,
  git,
  onAction,
  getWindowMetadata,
  bufferSearch,
  bufferSearchVisible,
  nvim: {
    state,
    setMode,
    watchState,
    onStateValue,
    getBufferInfo,
    onStateChange,
    call: nvimCall,
    expr: nvimExpr,
    untilStateValue,
    cmd: nvimCommand,
    getVar: nvimGetVar,
    jumpTo: nvimJumpTo,
    onLoad: nvimLoaded,
    feedkeys: nvimFeedkeys,
    getKeymap: nvimGetKeymap,
    saveCursor: nvimSaveCursor,
    getColorByName: nvimGetColorByName,
    jumpToProjectFile: nvimJumpToProjectFile,
    removeHighlightSearch: nvimRemoveHighlightSearch,
    highlightSearchPattern: nvimHighlightSearchPattern,
  }
}

export default api
