import { call, on } from '../messaging/worker-client'
import { GitStatus } from '../support/git'
import { NeovimAPI } from '../neovim/api'
import { VimMode } from '../neovim/types'

let nvim: NeovimAPI
let git: any

on.connect((path: string) => {
  ;(global as any).NVIM_PATH = path
  nvim = require('../neovim/api').default
  git = require('../support/git')
  nvim.onStateChange(nextState => call.nvimStateUpdate(nextState))
  nvim.onVimrcLoad(sourcedFile => call.vimrcLoaded(sourcedFile))
  git.onStatus((status: GitStatus) => call.gitStatus(status))
  git.onBranch((onBranch: string) => call.gitBranch(onBranch))
})

on.getGitInfo(async () => git.getGitInfo())
on.getState(async () => ({ ...nvim.state }))
on.getVar(async (key: string) => Reflect.get(nvim.g, key))
on.setNvimMode((mode: VimMode) => Object.assign(nvim.state, { mode }))
on.getWindowMetadata(async () => require('../windows/metadata').default())
