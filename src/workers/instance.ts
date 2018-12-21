import { VimMode, HyperspaceCoordinates } from '../neovim/types'
import { call, on } from '../messaging/worker-client'
import { GitStatus } from '../support/git'
import { NeovimAPI } from '../neovim/api'

let nvim: NeovimAPI
let git: any
let bufferSearch: any

const actions = new Map<string, (args: any) => void>()

on.connect((path: string) => {
  ;(global as any).NVIM_PATH = path
  nvim = require('../neovim/api').default
  git = require('../support/git')
  bufferSearch = require('../services/buffer-search')
  nvim.onStateChange(nextState => call.nvimStateUpdate(nextState))
  nvim.onVimrcLoad(sourcedFile => call.vimrcLoaded(sourcedFile))
  git.onStatus((status: GitStatus) => call.gitStatus(status))
  git.onBranch((onBranch: string) => call.gitBranch(onBranch))
})

on.onAction(async (name: string) => {
  if (!actions.has(name)) actions.set(name, (...a: any[]) => call.actionCalled(name, a))
  const cb = actions.get(name)!
  nvim.onAction(name, cb)
})

on.bufferSearch(async (file: string, query: string) => bufferSearch.fuzzy(file, query))
on.bufferSearchVisible(async (query: string) => bufferSearch.fuzzyVisible(query))
on.nvimJumpTo((coords: HyperspaceCoordinates) => nvim.jumpTo(coords))
on.nvimExpr(async (expr: string) => nvim.expr(expr))
on.nvimFeedkeys((keys: string, mode: string) => nvim.feedkeys(keys, mode))
on.nvimCall(async (name: string, args: any[]) => Reflect.get(nvim.call, name)(...args))
on.nvimCommand(async (command: string) => nvim.cmd(command))
on.nvimGetVar(async (key: string) => Reflect.get(nvim.g, key))
on.setNvimMode((mode: VimMode) => Object.assign(nvim.state, { mode }))
on.getBufferInfo(async () => nvim.buffers.listWithInfo())
on.getGitInfo(async () => git.getGitInfo())
on.getState(async () => ({ ...nvim.state }))
on.getWindowMetadata(async () => require('../windows/metadata').default())
on.nvimSaveCursor(async () => nvim.current.window.cursor)
on.nvimRestoreCursor((position: number[]) => nvim.current.window.setCursor(position[0], position[1]))
