import { call, on } from '../messaging/worker-client'
import { NeovimAPI } from '../neovim/api'

let nvim: NeovimAPI

on.connect((path: string) => {
  (global as any).NVIM_PATH = path
  nvim = require('../neovim/api').default
  nvim.onStateChange(nextState => call.nvimStateUpdate(nextState))
  nvim.onVimrcLoad(sourcedFile => call.vimrcLoaded(sourcedFile))
})

on.getState(async () => ({ ...nvim.state }))
on.getConfig(async (key: string) => Reflect.get(nvim.g, key))
