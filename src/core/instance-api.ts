import { getActiveInstance, onSwitchVim, onCreateVim, instances } from '../core/instance-manager'
import NeovimState from '../neovim/state'
import { VimMode } from '../neovim/types'
import { EventEmitter } from 'events'

const ee = new EventEmitter()
const { state, watchState, onStateValue, onStateChange, untilStateValue } = NeovimState('nvim-mirror')

onCreateVim(info => {
  const instance = getActiveInstance()
  if (!instance) return console.error('created nvim but was not able to get a reference to the Instance')

  instance.on.nvimStateUpdate((stateDiff: any) => {
    if (info.id !== instances.current) return
    Object.assign(state, stateDiff)
  })

  instance.on.vimrcLoaded(() => info.id && instances.current && ee.emit('nvim.load', false))
})

onSwitchVim(async () => {
  const updatedState = await getActiveInstance()!.request.getState()
  Object.assign(state, updatedState)
  ee.emit('nvim.load', true)
})

const nvimLoaded = (fn: (switchInstance: boolean) => void) => ee.on('nvim.load', fn)

const getVar = async (key: string) => {
  const instance = getActiveInstance()
  if (!instance) return
  return instance.request.getVar(key)
}

const setMode = (mode: VimMode) => {
  Object.assign(state, { mode })
  // TODO: notify instance of the mode change to update the state
  // since the worker nvim instance api does not have access to render events
}

const api = {
  nvim: {
    state,
    getVar,
    setMode,
    watchState,
    onStateValue,
    onStateChange,
    untilStateValue,
    onLoad: nvimLoaded,
  }
}

export default api
