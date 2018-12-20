import { getActiveInstance, onSwitchVim, onCreateVim, instances } from '../core/instance-manager'
import { WindowMetadata } from '../windows/metadata'
import { GitStatus } from '../support/git'
import NeovimState from '../neovim/state'
import { VimMode } from '../neovim/types'
import { EventEmitter } from 'events'

const ee = new EventEmitter()
const { state, watchState, onStateValue, onStateChange, untilStateValue } = NeovimState('nvim-mirror')
const actionRegistrations: string[] = []

onCreateVim(info => {
  const isActive = () => info.id && instances.current
  const instance = getActiveInstance()
  if (!instance) return console.error('created nvim but was not able to get a reference to the Instance')

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
  const updatedState = await getActiveInstance()!.request.getState()
  Object.assign(state, updatedState)
  const gitInfo = await getActiveInstance()!.request.getGitInfo()
  ee.emit('git.status', gitInfo.status)
  ee.emit('git.branch', gitInfo.branch)
  ee.emit('nvim.load', true)
})

const nvimLoaded = (fn: (switchInstance: boolean) => void) => ee.on('nvim.load', fn)

const getVar = async (key: string) => {
  const instance = getActiveInstance()
  if (!instance) return console.error('no active instance... wut')
  return instance.request.getVar(key)
}

const setMode = (mode: VimMode) => {
  Object.assign(state, { mode })
  const instance = getActiveInstance()
  if (!instance) return
  instance.call.setNvimMode(mode)
}

const getWindowMetadata = async (): Promise<WindowMetadata[]> => {
  const instance = getActiveInstance()
  if (!instance) return (console.error('no active instance... wut'), [])
  return instance.request.getWindowMetadata()
}

const onAction = (name: string, fn: (...args: any[]) => void) => {
  const instance = getActiveInstance()
  actionRegistrations.push(name)
  if (instance) instance.call.onAction(name)
  ee.on(`action.${name}`, fn)
}

const git = {
  onStatus: (fn: (status: GitStatus) =>  void) => ee.on('git.status', fn),
  onBranch: (fn: (branch: string) => void) => ee.on('git.branch', fn),
}

const nvimCommand = (command: string) => {
  const instance = getActiveInstance()
  if (!instance) return console.error('no active instance... WAT')
  instance.call.nvimCommand(command)
}

const api = {
  git,
  onAction,
  getWindowMetadata,
  nvim: {
    state,
    getVar,
    setMode,
    watchState,
    onStateValue,
    onStateChange,
    untilStateValue,
    cmd: nvimCommand,
    onLoad: nvimLoaded,
  }
}

export default api
