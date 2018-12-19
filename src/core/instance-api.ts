import { getActiveInstance, onSwitchVim, onCreateVim, instances } from '../core/instance-manager'
import NeovimState from '../neovim/state'

const { state, watchState, onStateValue, onStateChange, untilStateValue } = NeovimState('nvim-mirror')

onCreateVim(info => {
  getActiveInstance()!.on.nvimStateUpdate((stateDiff: any) => {
    if (info.id !== instances.current) return
    Object.assign(state, stateDiff)
  })
})

onSwitchVim(async () => {
  const updatedState = await getActiveInstance()!.request.getState()
  Object.assign(state, updatedState)
})

const api = {
  nvim: {
    state,
    watchState,
    onStateValue,
    onStateChange,
    untilStateValue,
  }
}

export default api
