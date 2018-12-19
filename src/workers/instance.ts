import { call, on } from '../messaging/worker-client'
import nvim from '../neovim/api'

nvim.onStateChange(nextState => call.nvimStateUpdate(nextState))

on.getState(async () => ({ ...nvim.state }))
