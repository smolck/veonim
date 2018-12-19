import { call } from '../messaging/worker-client'
import nvim from '../neovim/api'

nvim.onStateChange(nextState => call.nvimStateUpdate(nextState))
