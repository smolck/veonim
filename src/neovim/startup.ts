import { CmdGroup, FunctionGroup } from '../support/neovim-utils'
import { configPath } from '../support/utils'
import { resolve, join } from 'path'

const pluginDir = join(configPath, 'nvim', 'pack', 'veonim-installed-plugins')
const runtimeDir = resolve(__dirname, '..', 'runtime')
const startup = FunctionGroup()

// TODO: DEPRECATED REMOVE
startup.defineFunc.VK`
  echo "VK() map keyboard shortcuts is deprecated. please remove VK() calls from your config"
`

export const startupFuncs = () => startup.getFunctionsAsString()

export const startupCmds = CmdGroup`
  let $PATH .= ':${runtimeDir}/${process.platform}'
  let &runtimepath .= ',${runtimeDir}'
  let &packpath .= ',${pluginDir}'
  let g:veonim = 1
  let g:vn_cmd_completions = ''
  let g:vn_events = {}
  let g:vn_callbacks = {}
  let g:vn_callback_id = 0
  let g:vn_jobs_connected = {}
  let g:_veonim_plugins = []
  let g:_veonim_extensions = []
  let g:veonim_completing = 0
  let g:veonim_complete_pos = 1
  let g:veonim_completions = []
  colorscheme veonim
  set guicursor=n:block-CursorNormal,i:hor10-CursorInsert,v:block-CursorVisual
  set background=dark
  set nocursorline
  set noshowmode
  set completefunc=VeonimComplete
  ino <expr> <tab> VeonimCompleteScroll(1)
  ino <expr> <s-tab> VeonimCompleteScroll(0)
  map <silent> <c-z> <nop>
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
  SourcePre: `expand('<afile>')`,
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
  let m.dir = expand('%:p:h')
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
  call rpcnotify(0, 'veonim', a:1, a:000[1:])
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
