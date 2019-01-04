import { CmdGroup, FunctionGroup } from '../support/neovim-utils'
import { colorscheme } from '../config/default-configs'
import { Highlight } from '../neovim/types'
import { resolve } from 'path'

const runtimeDir = resolve(__dirname, '..', 'runtime')
const startup = FunctionGroup()

export const startupFuncs = () => startup.getFunctionsAsString()

// TODO: let g:neovim_loaded is a TEMP HACK and should be removed once we merge NEXT!!!

export const startupCmds = CmdGroup`
  let $PATH .= ':${runtimeDir}/${process.platform}'
  let &runtimepath .= ',${runtimeDir}'
  let g:veonim = 1
  let g:neovim_loaded = 0
  let g:vn_loaded = 0
  let g:vn_cmd_completions = ''
  let g:vn_rpc_buf = []
  let g:vn_events = {}
  let g:vn_callbacks = {}
  let g:vn_callback_id = 0
  let g:vn_jobs_connected = {}
  colorscheme ${colorscheme}
  set guicursor=n:block-CursorNormal,i:hor10-CursorInsert,v:block-CursorVisual
  set background=dark
  set laststatus=0
  set shortmess+=Ic
  set noshowcmd
  set noshowmode
  set noruler
  set nocursorline
  set completefunc=VeonimComplete
  ino <expr> <tab> VeonimCompleteScroll(1)
  ino <expr> <s-tab> VeonimCompleteScroll(0)
  map <silent> <c-z> <nop>
  call serverstart()
  call VeonimRegisterAutocmds()
`

// TODO: should we rename some of these "internal" functions so they
// don't obviously show up in the command completions when looking
// for 'Veonim' function name. something sort of prefix "_$VN_RegAutocmds"
//
// or maybe we move all these functions to a separate .vim script file?
// i wonder which functions are required for init.vim

const stateEvents = [
  'BufAdd',
  'BufEnter',
  'BufDelete',
  'BufUnload',
  'BufWipeout',
  'FileType',
  'ColorScheme',
  'DirChanged',
]

const autocmds = {
  BufAdd: `expand('<abuf>')`,
  BufEnter: `expand('<abuf>')`,
  BufDelete: `expand('<abuf>')`,
  BufUnload: `expand('<abuf>')`,
  BufWipeout: `expand('<abuf>')`,
  BufWritePre: `expand('<abuf>')`,
  BufWritePost: `expand('<abuf>')`,
  CursorMoved: null,
  CursorMovedI: null,
  CompleteDone: `v:completed_item`,
  InsertEnter: null,
  InsertLeave: null,
  TextChanged: `b:changedtick`,
  TextChangedI: `b:changedtick`,
  OptionSet: `expand('<amatch>'), v:option_new, v:option_old`,
  FileType: `bufnr(expand('<afile>')), expand('<amatch>')`,
  WinEnter: `win_getid()`,
}

export type Autocmd = typeof autocmds
export type Autocmds = keyof Autocmd

const autocmdsText = Object.entries(autocmds)
  .map(([ cmd, arg ]) => {
    const argtext = arg ? `, ${arg}` : ''
    return `au VeonimAU ${cmd} * call rpcnotify(0, 'veonim-autocmd', '${cmd}'${argtext})`
  })
  .join('\n')

// autocmds in a separate function because chaining autocmds with "|" is bad
// it makes the next autocmd a continuation of the previous
startup.defineFunc.VeonimRegisterAutocmds`
  aug VeonimAU | au! | aug END
  au VeonimAU CursorMoved,CursorMovedI * call rpcnotify(0, 'veonim-position', VeonimPosition())
  au VeonimAU VimEnter * let g:neovim_loaded = 2
  au VeonimAU ${stateEvents.join(',')} * call rpcnotify(0, 'veonim-state', VeonimState())
  ${autocmdsText}
`

startup.defineFunc.VeonimComplete`
  return a:1 ? g:veonim_complete_pos : g:veonim_completions
`

startup.defineFunc.VeonimCompleteScroll`
  if len(g:veonim_completions)
    if g:veonim_completing
      return a:1 ? "\\<c-n>" : "\\<c-p>"
    endif

    let g:veonim_completing = 1
    return a:1 ? "\\<c-x>\\<c-u>" : "\\<c-x>\\<c-u>\\<c-p>\\<c-p>"
  endif

  return a:1 ? "\\<tab>" : "\\<c-w>"
`

startup.defineFunc.VeonimState`
  let m = {}
  let currentBuffer = bufname('%')
  let p = getcurpos()
  let m.line = p[1]-1
  let m.column = p[2]-1
  let m.revision = b:changedtick
  let m.filetype = getbufvar(currentBuffer, '&filetype')
  let m.cwd = getcwd()
  let m.file = expand('%f')
  let m.colorscheme = g:colors_name
  let m.bufferType = getbufvar(currentBuffer, '&buftype')
  let m.editorTopLine = line('w0')
  let m.editorBottomLine = line('w$')
  let m.absoluteFilepath = expand('%:p')
  return m
`

startup.defineFunc.VeonimPosition`
  let m = {}
  let p = getcurpos()
  let m.line = p[1]-1
  let m.column = p[2]-1
  let m.editorTopLine = line('w0')
  let m.editorBottomLine = line('w$')
  return m
`

startup.defineFunc.VeonimTermReader`
  if has_key(g:vn_jobs_connected, a:1)
    call rpcnotify(0, 'veonim', 'job-output', [a:1, a:2])
  endif
`

startup.defineFunc.VeonimTermExit`
  call remove(g:vn_jobs_connected, a:1)
`

startup.defineFunc.Veonim`
  if g:vn_loaded
    call rpcnotify(0, 'veonim', a:1, a:000[1:])
  else
    call add(g:vn_rpc_buf, a:000)
  endif
`

startup.defineFunc.VeonimCmdCompletions`
  return g:vn_cmd_completions
`

// TODO: figure out how to add multiple fn lambdas but dedup'd! (as a Set)
// index(g:vn_events[a:1], a:2) < 0 does not work
startup.defineFunc.VeonimRegisterEvent`
  let g:vn_events[a:1] = a:2
`

startup.defineFunc.VeonimCallEvent`
  if has_key(g:vn_events, a:1)
    let Func = g:vn_events[a:1]
    call Func()
  endif
`

startup.defineFunc.VeonimCallback`
  if has_key(g:vn_callbacks, a:1)
    let Funky = g:vn_callbacks[a:1]
    call Funky(a:2)
  endif
`

startup.defineFunc.VeonimRegisterMenuCallback`
  let g:vn_callbacks[a:1] = a:2
`

startup.defineFunc.VeonimMenu`
  let g:vn_callback_id += 1
  call VeonimRegisterMenuCallback(g:vn_callback_id, a:3)
  call Veonim('user-menu', g:vn_callback_id, a:1, a:2)
`

startup.defineFunc.VeonimOverlayMenu`
  let g:vn_callback_id += 1
  call VeonimRegisterMenuCallback(g:vn_callback_id, a:3)
  call Veonim('user-overlay-menu', g:vn_callback_id, a:1, a:2)
`

startup.defineFunc.VK`
  call VeonimRegisterEvent('key:' . a:2 . ':' . a:1, a:3)
  call Veonim('register-shortcut', a:1, a:2)
`

// we are going to override any of these user settings, because the user is
// WRONG.  TODO: jk, the problem is we are hacking our own window grids, and
// the cmd/msgline/lastrow is not hidden from the render output. these
// settings fix some of those issues.  however once we get official support
// for external windows from nvim, we should not need these
//
// laststatus=0 ---> disable statusline
// nocursorline ---> we render our own cursorline based on cursor position. this is a bit
//                  hacky. i think we will get official support soonish™
// shortmess+=Ic --> disable completion "item 1 of 3" messages in message/cmdline/lastrow
// noshowmode -----> no "--INSERT--" bullshit in lastrow
// noshowcmd ------> disable the visual keybinds in lastrow, like "ciw" displays "c" in botright
// noruler --------> no "42,13" line,column display in lastrow
//
// if we cleanup any commands from here in the future, remember to clean them
// up also from 'startupCmds' (if applicable)
//
// TODO: we should probably not override the completion settings and mappings
export const postStartupCommands = CmdGroup`
  let g:vn_loaded = 1
  set laststatus=0
  set nocursorline
  set shortmess+=Ic
  set noshowmode
  set noshowcmd
  set noruler
  let g:veonim_completing = 0
  let g:veonim_complete_pos = 1
  let g:veonim_completions = []
  set completefunc=VeonimComplete
  ino <expr> <tab> VeonimCompleteScroll(1)
  ino <expr> <s-tab> VeonimCompleteScroll(0)
  highlight ${Highlight.Underline} gui=underline
  highlight ${Highlight.Undercurl} gui=undercurl
`
