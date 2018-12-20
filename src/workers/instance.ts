import { call, on } from '../messaging/worker-client'
import getWindowMetadata from '../windows/metadata'
import { NeovimAPI } from '../neovim/api'
import { VimMode } from '../neovim/types'

let nvim: NeovimAPI

on.connect((path: string) => {
  (global as any).NVIM_PATH = path
  nvim = require('../neovim/api').default
  nvim.onStateChange(nextState => call.nvimStateUpdate(nextState))
  nvim.onVimrcLoad(sourcedFile => call.vimrcLoaded(sourcedFile))
})

on.getState(async () => ({ ...nvim.state }))
on.getVar(async (key: string) => Reflect.get(nvim.g, key))
on.setNvimMode((mode: VimMode) => Object.assign(nvim.state, { mode }))
on.getWindowMetadata(getWindowMetadata)
