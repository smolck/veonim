import { moveCursor, cursor, CursorShape, setCursorColor, setCursorShape } from '../core/cursor'
import { asColor, merge, matchOn, CreateTask, debounce, is } from '../support/utils'
import { onRedraw, getColor, getMode } from '../core/master-control'
import { getWindow, applyToWindows } from '../core/windows'
import * as canvasContainer from '../core/canvas-container'
import { normalizeVimMode } from '../support/neovim-utils'
import { Events, ExtContainer } from '../neovim/protocol'
import { NotifyKind, notify } from '../ui/notifications'
import * as dispatch from '../messaging/dispatch'
import fontAtlas from '../core/font-atlas'
import * as grid from '../core/grid'
import nvim from '../core/neovim'

type NotificationKind = 'error' | 'warning' | 'info' | 'success' | 'hidden' | 'system'

interface Colors {
  fg: string,
  bg: string,
  sp: string,
}

interface Mode {
  shape: CursorShape,
  size?: number,
  color?: string,
}

interface ScrollRegion {
  top: number,
  bottom: number,
  left: number,
  right: number,
}

interface Attrs {
  foreground?: number,
  background?: number,
  special?: number,
  reverse?: string,
  italic?: string,
  bold?: string,
  underline?: boolean,
  undercurl?: boolean,
}

interface NextAttrs extends Attrs {
  fg: string,
  bg: string,
  sp: string,
}

interface ModeInfo {
  blinkoff?: number,
  blinkon?: number,
  blinkwait?: number,
  cell_percentage?: number,
  cursor_shape?: string,
  hl_id?: number,
  id_lm?: number,
  mouse_shape?: number,
  name: string,
  short_name: string,
}

interface PMenuItem {
  word: string,
  kind: string,
  menu: string,
  info: string,
}

type CmdContent = [any, string]

export enum CommandType {
  Ex,
  Prompt,
  SearchForward,
  SearchBackward,
}

export interface CommandUpdate {
  cmd: string,
  kind: CommandType,
  position: number,
}

interface CommandLineCache {
  cmd?: string,
  active: boolean,
  position: number,
}

let lastScrollRegion: ScrollRegion | null = null
let currentMode: string
const commonColors = new Map<string, number>()

const recordColor = (color: string) => {
  const count = commonColors.get(color) || 0
  commonColors.set(color, count + 1)
}

const getTopColors = (amount = 16) => Array
  .from(commonColors.entries())
  .sort((a, b) => a[1] < b[1] ? 1 : -1)
  .slice(0, amount)
  .map(m => m[0])

const cmdcache: CommandLineCache = {
  active: false,
  position: -999,
}

const attrDefaults: Attrs = {
  underline: false,
  undercurl: false
}

const api = new Map<string, Function>()
const modes = new Map<string, Mode>()

// because a Map is higher perf than an object
const r: Events = new Proxy(api, {
  set: (_: any, name, fn) => (api.set(name as string, fn), true)
})

const colors: Colors = {
  fg: '#dddddd',
  bg: '#2d2d2d',
  sp: '#ef5188'
}

const nextAttrs: NextAttrs = {
  fg: colors.fg,
  bg: colors.bg,
  sp: colors.sp,
}

const defaultScrollRegion = (): ScrollRegion => ({
  top: 0,
  left: 0,
  right: canvasContainer.size.cols,
  bottom: canvasContainer.size.rows,
})

const cursorShapeType = (shape?: string) => {
  if (shape === 'block') return CursorShape.block
  if (shape === 'horizontal') return CursorShape.underline
  if (shape === 'vertical') return CursorShape.line
  else return CursorShape.block
}

const moveRegionUp = (amount: number, { top, bottom, left, right }: ScrollRegion) => {
  const w = getWindow(top, left)
  const width = right - left + 1
  const height = bottom - (top + amount) + 1

  const region = {
    width,
    height,
    source: {
      col: left,
      row: top + amount,
    },
    destination: {
      col: left,
      row: top,
    }
  }

  w && w
    .moveRegion(region)
    .setColor(colors.bg)
    .fillRect(left, bottom - amount + 1, right - left + 1, amount)

  grid.moveRegionUp(amount, top, bottom, left, right)
}

const moveRegionDown = (amount: number, { top, bottom, left, right }: ScrollRegion) => {
  const w = getWindow(top, left)
  const width = right - left + 1
  const height = bottom - (top + amount) + 1

  const region = {
    width,
    height,
    source: {
      col: left,
      row: top
    },
    destination: {
      col: left,
      row: top + amount
    }
  }

  w && w
    .moveRegion(region)
    .setColor(colors.bg)
    .fillRect(left, top, right - left + 1, amount)

  grid.moveRegionDown(amount, top, bottom, left, right)
}

r.cursor_goto = (row, col) => merge(cursor, { col, row })
r.set_scroll_region = (top, bottom, left, right) => lastScrollRegion = { top, bottom, left, right }

r.clear = () => {
  applyToWindows(w => w.setColor(colors.bg).clear())
  grid.clear()
}

r.eol_clear = () => {
  const win = getWindow(cursor.row, cursor.col)

  win && win
    .setColor(colors.bg)
    .fillRect(cursor.col, cursor.row, canvasContainer.size.cols, 1)

  grid.clearLine(cursor.row, cursor.col)
}

r.update_fg = fg => {
  if (fg < 0) return
  merge(colors, { fg: asColor(fg) })
  nvim.state.foreground = colors.fg
  grid.setForeground(colors.fg)
}

r.update_bg = bg => {
  if (bg < 0) return
  merge(colors, { bg: asColor(bg) })
  nvim.state.background = colors.bg
  grid.setBackground(colors.bg)
}

r.update_sp = sp => {
  if (sp < 0) return
  merge(colors, { sp: asColor(sp) })
  nvim.state.special = colors.sp
  grid.setSpecial(colors.sp)
}

r.mode_info_set = (_, infos: ModeInfo[]) => infos.forEach(async mi => {
  const info = {
    shape: cursorShapeType(mi.cursor_shape),
    size: mi.cell_percentage
  }

  if (mi.hl_id) {
    const { bg } = await getColor(mi.hl_id)
    merge(info, { color: bg || colors.fg })
    if (mi.name === currentMode && bg) {
      setCursorColor(bg)
      setCursorShape(info.shape, info.size)
    }
  }

  modes.set(mi.name, info)
})

r.mode_change = async mode => {
  nvim.state.mode = normalizeVimMode(mode)
  currentMode = mode
  const info = modes.get(mode)
  if (!info) return
  info.color && setCursorColor(info.color)
  setCursorShape(info.shape, info.size)
}

r.highlight_set = (attrs: Attrs) => {
  const fg = attrs.foreground ? asColor(attrs.foreground) : colors.fg
  const bg = attrs.background ? asColor(attrs.background) : colors.bg
  const sp = attrs.special ? asColor(attrs.special) : colors.sp

  attrs.reverse
    ? merge(nextAttrs, attrDefaults, attrs, { sp, bg: fg, fg: bg })
    : merge(nextAttrs, attrDefaults, attrs, { sp, fg, bg })

  recordColor(nextAttrs.fg)
}

r.scroll = amount => {
  amount > 0
    ? moveRegionUp(amount, lastScrollRegion || defaultScrollRegion())
    : moveRegionDown(-amount, lastScrollRegion || defaultScrollRegion())

  lastScrollRegion = null
}

r.resize = () => merge(cursor, { row: 0, col: 0 })


r.put = chars => {
  const total = chars.length
  if (!total) return

  const underlinePls = !!(nextAttrs.undercurl || nextAttrs.underline)
  const { row: ogRow, col: ogCol } = cursor
  const win = getWindow(cursor.row, cursor.col)
  //// TODO: get all windows which apply for this range
  //or is it even an issue? aka always in range of window dimensions?
  //add check in canvas-window fillRect to see if out of bounds
  win && win
    .setColor(nextAttrs.bg)
    .fillRect(cursor.col, cursor.row, total, 1)
    .setColor(nextAttrs.fg)
    .setTextBaseline('top')

  for (let ix = 0; ix < total; ix++) {
    if (chars[ix][0] !== ' ') {
      // TODO: can we get window valid for the given range instead of each lookup?
      const w = getWindow(cursor.row, cursor.col)
      w && w.fillText(chars[ix][0], cursor.col, cursor.row)
    }

    grid.set(cursor.row, cursor.col, chars[ix][0], nextAttrs.fg, nextAttrs.bg, underlinePls, nextAttrs.sp)

    cursor.col++
  }

  if (win && underlinePls) win.underline(ogCol, ogRow, total, nextAttrs.sp)
}

r.set_title = title => dispatch.pub('vim:title', title)

r.popupmenu_hide = () => dispatch.pub('pmenu.hide')
r.popupmenu_select = (ix: number) => dispatch.pub('pmenu.select', ix)
r.popupmenu_show = (items: PMenuItem[], ix: number, row: number, col: number) =>
  dispatch.pub('pmenu.show', { items, ix, row, col })

r.tabline_update = (curtab: ExtContainer, tabs: ExtContainer[]) => dispatch.pub('tabs', { curtab, tabs })

r.wildmenu_show = items => dispatch.pub('wildmenu.show', items)
r.wildmenu_select = selected => dispatch.pub('wildmenu.select', selected)
r.wildmenu_hide = () => dispatch.pub('wildmenu.hide')

let currentCommandMode: CommandType

r.cmdline_show = (content: CmdContent[], position, opChar, prompt, indent, level) => {
  cmdcache.active = true
  cmdcache.position = position

  // TODO: process attributes!
  const cmd = content.reduce((str, [ _, item ]) => str + item, '')
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

r.cmdline_hide = () => {
  merge(cmdcache, { active: false, position: -999, cmd: undefined })
  dispatch.pub('cmd.hide')
  dispatch.pub('search.hide')
}

r.cmdline_pos = position => {
  if (currentCommandMode === CommandType.Ex) dispatch.pub('cmd.update', { position })
  else dispatch.pub('search.update', { position })
}

// from neovim PR 7466:
// Multiple msg_chunk calls build up a msg line, msg_end tells the line is finished.
// msg_start_kind(...) tells the kind for some kinds of messages, but clients should be 
// prepared msg_chunk:s come without a msg_start_kind(). msg_showcmd([attrs, text]) works 
// independently of all other events.

const msgKinds = new Map<string, NotificationKind>([
  ['emsg', 'error'],
  ['echo', 'info'],
  ['echomsg', 'info'],
])

const message = {
  buffer: '',
  kind: 'info' as NotificationKind,
}

const resetMsg = () => {
  message.buffer = ''
  setTimeout(() => message.kind = 'hidden', 1)
}

r.msg_start_kind = kind => {
  if (msgKinds.has(kind)) message.kind = msgKinds.get(kind)!

  else if (kind === 'showmode') setTimeout(() => {
    if (message.buffer.includes('recording @')) {
      const [ , register ] = message.buffer.match(/recording @(\w)/) || [] as string[]
      dispatch.pub('vim:macro.start', register)
    }
  }, 30)

  else console.log('new msg kind:', kind)
}

// TODO: join or call foreach?
r.msg_showcmd = (content = []) => notify(content.join(''))

let spellCheckMsg = [] as string[]
let capturingSpellCheckMsg = false

r.msg_chunk = data => {
  const startSpellCheckMsg = /Change "\w+" to:/.test(data)
  const endSpellCheckMsg = /Type number and <Enter>/.test(data)

  if (startSpellCheckMsg) capturingSpellCheckMsg = true
  if (capturingSpellCheckMsg) spellCheckMsg.push(data)
  if (endSpellCheckMsg) {
    capturingSpellCheckMsg = false
    dispatch.pub('msg:spell-check', spellCheckMsg.join(''))
    spellCheckMsg = []
  }

  message.buffer += data
}

r.msg_end = () => {
  // TODO: this only happens at startup, so maybe run this condition for a limitied period of time
  // TODO: test without plugins!
  if (message.buffer === '<') return resetMsg()
  if (!message.kind) notify(message.buffer, NotifyKind.Hidden)

  if (/recording @\w/.test(message.buffer)) return dispatch.pub('vim:macro.end')

  matchOn(message.kind)({
    [NotifyKind.Error]: () => notify(message.buffer, NotifyKind.Error),
    [NotifyKind.Warning]: () => notify(message.buffer, NotifyKind.Warning),
    [NotifyKind.Info]: () => notify(message.buffer, NotifyKind.Info),
    [NotifyKind.Success]: () => notify(message.buffer, NotifyKind.Success),
  })

  resetMsg()
}

let lastTop: string[] = []
let initialAtlasGenerated = false
const initalFontAtlas = CreateTask()

initalFontAtlas.promise.then(() => {
  fontAtlas.generate([ colors.fg ])
  initialAtlasGenerated = true
})

const sameColors = (colors: string[]) => colors.every(c => lastTop.includes(c))

const generateFontAtlas = () => {
  const topColors = getTopColors()
  const genColors = [...new Set([...topColors, colors.fg])]
  fontAtlas.generate(genColors)
}

const regenerateFontAtlastIfNecessary = debounce(() => {
  const topColors = getTopColors()
  if (!sameColors(topColors)) {
    const genColors = [...new Set([ ...topColors, colors.fg ])]
    fontAtlas.generate(genColors)
  }
  lastTop = topColors
}, 100)

const cmdlineIsSame = (...args: any[]) => cmdcache.active && cmdcache.position === args[1]

const doNotUpdateCmdlineIfSame = (args: any[]) => {
  if (!args || !is.array(args)) return false
  const [ cmd, data ] = args
  if (cmd !== 'cmdline_show') return false
  return cmdlineIsSame(...data)
}

onRedraw((m: any[]) => {
  // because of circular logic/infinite loop. cmdline_show updates UI, UI makes
  // a change in the cmdline, nvim sends redraw again. we cut that shit out
  // with coding and algorithms
  if (doNotUpdateCmdlineIfSame(m[0])) return

  const count = m.length
  for (let ix = 0; ix < count; ix++) {
    const [ method, ...args ] = m[ix]

    // TODO: should prioritize the main events (put, etc.) and process stuff like 'tabline' later
    const fn = api.get(method)
    if (fn) method === 'put' 
      ? fn(args)
      : args.forEach((a: any[]) => fn(...a))
  }

  lastScrollRegion = null
  moveCursor(colors.bg)

  setImmediate(() => {
    dispatch.pub('redraw')
    if (!initialAtlasGenerated) initalFontAtlas.done(true)
    regenerateFontAtlastIfNecessary()
    getMode().then(m => nvim.state.mode = normalizeVimMode(m.mode))
  })
})

canvasContainer.on('device-pixel-ratio-changed', generateFontAtlas)
