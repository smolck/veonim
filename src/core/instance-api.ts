import { getActiveInstance, onSwitchVim, onCreateVim, instances } from '../core/instance-manager'
import { VimMode, BufferInfo, HyperspaceCoordinates } from '../neovim/types'
import { Functions } from '../neovim/function-types'
import { WindowMetadata } from '../windows/metadata'
import { onFnCall } from '../support/utils'
import { GitStatus } from '../support/git'
import NeovimState from '../neovim/state'
import { EventEmitter } from 'events'

const ee = new EventEmitter()
const { state, watchState, onStateValue, onStateChange, untilStateValue } = NeovimState('nvim-mirror')
const actionRegistrations: string[] = []

onCreateVim(info => {
  const isActive = () => info.id && instances.current
  const instance = getActiveInstance()

  if (actionRegistrations.length) actionRegistrations.forEach(name => instance.call.onAction(name))

  instance.on.nvimStateUpdate((stateDiff: any) => {
    if (info.id !== instances.current) return
    Object.assign(state, stateDiff)
  })

  instance.on.vimrcLoaded(() => isActive() && ee.emit('nvim.load', false))
  instance.on.gitStatus((status: GitStatus) => isActive() && ee.emit('git.status', status))
  instance.on.gitBranch((branch: string) => isActive() && ee.emit('git.branch', branch))
  instance.on.actionCalled((name: string, args: any[]) => isActive() && ee.emit(`action.${name}`, ...args))
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
const nvimGetVar = async (key: string) => getActiveInstance().request.nvimGetVar(key)
const nvimCommand = (command: string) => getActiveInstance().call.nvimCommand(command)
const nvimFeedkeys = (keys: string, mode = 'm') => getActiveInstance().call.nvimFeedkeys(keys, mode)
const nvimExpr = (expr: string) => getActiveInstance().request.nvimExpr(expr)
const nvimCall: Functions = onFnCall(async (name, a) => getActiveInstance().request.nvimCall(name, a))
const nvimJumpTo = (coords: HyperspaceCoordinates) => getActiveInstance().call.nvimJumpTo(coords)
const nvimSaveCursor = async () => {
  const instance = getActiveInstance()
  const position = await instance.request.nvimSaveCursor()
  return () => instance.call.nvimRestoreCursor(position)
}

const api = {
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
    saveCursor: nvimSaveCursor,
  }
}

export default api
