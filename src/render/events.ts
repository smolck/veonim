import { CursorShape, setCursorColor, setCursorShape } from '../core/cursor'
import { getBackground } from '../render/highlight-attributes'
import { notify, NotifyKind } from '../ui/notifications'
import * as dispatch from '../messaging/dispatch'
import * as workspace from '../core/workspace'
import { VimMode } from '../neovim/types'
import nvim from '../neovim/api'

interface Mode {
  shape: CursorShape
  hlid?: number
  size?: number
}

interface ModeInfo {
  blinkoff?: number
  blinkon?: number
  blinkwait?: number
  cell_percentage?: number
  cursor_shape?: string
  attr_id?: number
  attr_id_lm?: number
  hl_id?: number
  id_lm?: number
  mouse_shape?: number
  name: string
  short_name: string
}

type CmdContent = [any, string]

interface PMenuItem {
  word: string,
  kind: string,
  menu: string,
  info: string,
}

interface CommandLineCache {
  cmd?: string
  active: boolean
  position: number
}

export enum CommandType {
  Ex,
  Prompt,
  SearchForward,
  SearchBackward,
}

export interface CommandUpdate {
  cmd: string
  kind: CommandType
  position: number
}

// because we skip allocating 1-char strings in msgpack decode. so if we have a 1-char
// string it might be a code point number - need to turn it back into a string. see
// msgpack-decoder for more info on how this works.
const sillyString = (s: any): string => typeof s === 'number' ? String.fromCodePoint(s) : s

const modes = new Map<string, Mode>()
const options = new Map<string, any>()

const normalizeVimMode = (mode: string): VimMode => {
  if (mode === 't') return VimMode.Terminal
  if (mode === 'n' || mode === 'normal') return VimMode.Normal
  if (mode === 'i' || mode === 'insert') return VimMode.Insert
  if (mode === 'V' || mode === 'visual') return VimMode.Visual
  if (mode === 'R' || mode === 'replace') return VimMode.Replace
  if (mode === 'no' || mode === 'operator') return VimMode.Operator
  if (mode === 'c' || mode === 'cmdline_normal') return VimMode.CommandNormal
  if (mode === 'cmdline_insert') return VimMode.CommandInsert
  if (mode === 'cmdline_replace') return VimMode.CommandReplace
  // there are quite a few more modes available. see `mode_info_set`
  else return VimMode.SomeModeThatIProbablyDontCareAbout
}

const cursorShapeType = (shape?: string) => {
  if (shape === 'block') return CursorShape.block
  if (shape === 'horizontal') return CursorShape.underline
  if (shape === 'vertical') return CursorShape.line
  else return CursorShape.block
}

const messageNotifyKindMappings = new Map([
  ['echo', NotifyKind.Info],
  ['emsg', NotifyKind.Error],
])

// TODO: handle multi-line messages
type MessageEvent = [number, string]
export const msg_show = ([ , [ kind, msgs, flag ] ]: [any, [string, MessageEvent[], boolean]]) => {
  // TODO: map message kind to err/warn/info/etc
  // TODO: what is flag?
  console.log('MSG OF:', kind, flag)
  const skind = sillyString(kind)
  // TODO: i think no msg kind means we don't show it??? or do we??
  if (!skind) return

  const notifyKind = messageNotifyKindMappings.get(skind)
  if (!notifyKind) console.warn('PLS MAP msg kind:', JSON.stringify(skind))
  // TODO: do something with hlid or ignore?
  msgs.forEach(([ /*hlid*/, text ]) => notify(sillyString(text), notifyKind))
}

// TODO: wat do here lol - macro msg and shit?
export const msg_showmode = ([, [ msgs ]]: any) => {
  msgs.forEach((m: [number, string]) => console.log('MSG_SHOWMODE:', m[0], m[1]))
}

export const mode_change = ([ , [ m ] ]: [any, [string]]) => {
  const mode = sillyString(m)
  nvim.state.mode = normalizeVimMode(mode)
  const info = modes.get(mode)
  if (!info) return

  if (info.hlid) {
    const bg = getBackground(info.hlid)
    if (bg) setCursorColor(bg)
  }

  setCursorShape(info.shape, info.size)
}

// TODO: this parsing logic needs to be revisited
const updateFont = () => {
  const lineHeight = options.get('linespace')
  const guifont = options.get('guifont') || ''

  if (!lineHeight && !guifont) return

  const [ font ] = guifont.match(/(?:\\,|[^,])+/g) || ['']
  const [ face, ...settings] = font.split(':')
  const height = settings.find((s: string) => s.startsWith('h'))
  const size = Math.round(<any>(height || '').slice(1)-0)

  workspace.setFont({ face, size, lineHeight })
}

export const option_set = (e: any) => {
  e.slice(1).forEach(([ k, value ]: any) => options.set(sillyString(k), value))
  updateFont()
}

export const mode_info_set = ([ , [ , infos ] ]: any) => infos.forEach((m: ModeInfo) => {
  const info = {
    shape: cursorShapeType(sillyString(m.cursor_shape)),
    size: m.cell_percentage,
    hlid: m.attr_id,
  }

  modes.set(m.name, info)
})

export const set_title = ([ , [ title ] ]: [any, [string]]) => dispatch.pub('vim:title', sillyString(title))

export const popupmenu_hide = () => dispatch.pub('pmenu.hide')
export const popupmenu_select = ([ , [ ix ] ]: [any, [number]]) => dispatch.pub('pmenu.select', ix)
export const popupmenu_show = ([ , [ items, ix, row, col ] ]: [any, [PMenuItem[], number, number, number]]) => {
  dispatch.pub('pmenu.show', { items, ix, row, col })
}

export const wildmenu_show = ([ , [ items ] ]: any) => dispatch.pub('wildmenu.show', items)
export const wildmenu_hide = () => dispatch.pub('wildmenu.hide')
export const wildmenu_select = ([ , [ selected ] ]: [any, [number]]) => {
  dispatch.pub('wildmenu.select', selected)
}

const cmdlineIsSame = (...args: any[]) => cmdcache.active && cmdcache.position === args[1]

export const doNotUpdateCmdlineIfSame = (args: any[]) => {
  if (!args || !Array.isArray(args)) return false
  const [ cmd, data ] = args
  if (cmd !== 'cmdline_show') return false
  return cmdlineIsSame(...data)
}

let currentCommandMode: CommandType
const cmdcache: CommandLineCache = {
  active: false,
  position: -999,
}

type CmdlineShow = [ CmdContent[], number, string, string, number, number ]
export const cmdline_show = ([ , [content, position, str1, str2, indent, level] ]: [any, CmdlineShow]) => {
  const opChar = sillyString(str1)
  const prompt = sillyString(str2)
  cmdcache.active = true
  cmdcache.position = position

  // TODO: process attributes!
  const cmd = content.reduce((str, [ _, item ]) => str + sillyString(item), '')
  if (cmdcache.cmd === cmd) return
  cmdcache.cmd = cmd

  const kind: CommandType = Reflect.get({
    ':': CommandType.Ex,
    '/': CommandType.SearchForward,
    '?': CommandType.SearchBackward,
  }, opChar) || CommandType.Ex

  currentCommandMode = kind

  const cmdPrompt = kind === CommandType.Ex
  const searchPrompt = kind === CommandType.SearchForward || kind === CommandType.SearchBackward

  if (cmdPrompt) dispatch.pub('cmd.update', {
    cmd,
    kind: prompt ? CommandType.Prompt : kind,
    position
  } as CommandUpdate)

  else if (searchPrompt) dispatch.pub('search.update', {
    cmd,
    kind: prompt ? CommandType.Prompt : kind,
    position
  } as CommandUpdate)

  // TODO: do the indentings thingies
  indent && console.log('indent:', indent)
  level > 1 && console.log('level:', level)
}

export const cmdline_hide = () => {
  Object.assign(cmdcache, { active: false, position: -999, cmd: undefined })
  dispatch.pub('cmd.hide')
  dispatch.pub('search.hide')
}

export const cmdline_pos = ([ , [ position ] ]: [any, [number]]) => {
  if (currentCommandMode === CommandType.Ex) dispatch.pub('cmd.update', { position })
  else dispatch.pub('search.update', { position })
}
