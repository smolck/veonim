import { getActiveInstance, onSwitchVim } from '../core/instance-manager'
import NeovimState from '../neovim/state'

const { state, watchState, onStateValue, onStateChange, untilStateValue } = NeovimState('nvim-mirror')
let instance = getActiveInstance()

onSwitchVim(() => {
  instance = getActiveInstance()!
  instance.on.nvimStateUpdate((stateDiff: any) => Object.assign(state, stateDiff))
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
