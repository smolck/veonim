import { asColor, MapSet, MapMap } from '../support/utils'
import { instances } from '../core/instance-manager'
import { pub } from '../messaging/dispatch'
import api from '../core/instance-api'
import { EventEmitter } from 'events'

const ee = new EventEmitter()

export interface Attrs {
  foreground?: number
  background?: number
  special?: number
  reverse?: string
  italic?: string
  bold?: string
  underline?: boolean
  undercurl?: boolean
  cterm_fg?: number
  cterm_bg?: number
}

interface Color {
  foreground?: string
  background?: string
}

interface HighlightGroup {
  foreground?: string
  background?: string
  special?: string
  underline: boolean
  reverse: boolean
}

interface HighlightInfoEvent {
  kind: 'ui' | 'syntax' | 'terminal'
  ui_name: string
  hi_name: string
  id: number
}

interface HighlightInfo {
  kind: 'ui' | 'syntax' | 'terminal'
  name: string
  builtinName: string
  id: number
  hlid: number
}

interface DefaultColors {
  background: string
  foreground: string
  special: string
}

const defaultAppColors = {
  background: '#2d2d2d',
  foreground: '#dddddd',
  special: '#a966ad',
}

const defaultColors = new Map<number, DefaultColors>()

const getCurrentDefaultColors = (): DefaultColors => {
  const colors = defaultColors.get(instances.current)
  if (colors) return colors
  console.error(`could not get default colors for instance: ${instances.current}`)
  return defaultAppColors
}

export const colors: DefaultColors = new Proxy(Object.create(null), {
  set: () => true,
  get: (_: any, key: string) => {
    const defaultColors = getCurrentDefaultColors()
    return Reflect.get(defaultColors, key)
  },
})

// because we skip allocating 1-char strings in msgpack decode. so if we have a 1-char
// string it might be a code point number - need to turn it back into a string. see
// msgpack-decoder for more info on how this works.
const sillyString = (s: any): string => typeof s === 'number' ? String.fromCodePoint(s) : s

// TODO: make instance based
const highlightInfo = new MapSet()
const canvas = document.createElement('canvas')
const ui = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D
// TODO: make instance based

const highlights = MapMap<number, number, HighlightGroup>()

// TODO: do we need this here?
// const highlights = new Map<number, HighlightGroup>([
//   [0, {
//     background: defaultColors.background,
//     foreground: defaultColors.foreground,
//     special: defaultColors.special,
//     underline: false,
//     reverse: false,
//   }]
// ])

export const setDefaultColors = (fg: number, bg: number, sp: number) => {
  const defaultColors = getCurrentDefaultColors()

  const foreground = fg >= 0 ? asColor(fg) : defaultColors.foreground
  const background = bg >= 0 ? asColor(bg) : defaultColors.background
  const special = sp >= 0 ? asColor(sp) : defaultColors.special

  const same = defaultColors.foreground === foreground
    && defaultColors.background === background
    && defaultColors.special === special

  if (same) return false

  Object.assign(defaultColors, { foreground, background, special })

  pub('colors-changed', {
    fg: defaultColors.foreground,
    bg: defaultColors.background,
  })

  // hlid 0 -> default highlight group
  highlights.set(instances.current, 0, {
    foreground,
    background,
    special,
    underline: false,
    reverse: false,
  })

  return true
}

export const addHighlight = (id: number, attr: Attrs, infos: HighlightInfoEvent[]) => {
  const foreground = attr.reverse
    ? asColor(attr.background)
    : asColor(attr.foreground)

  const background = attr.reverse
    ? asColor(attr.foreground)
    : asColor(attr.background)

  highlights.set(instances.current, id, {
    foreground,
    background,
    special: asColor(attr.special),
    underline: !!(attr.underline || attr.undercurl),
    reverse: !!attr.reverse,
  })

  infos.forEach(info => {
    const name = sillyString(info.hi_name)
    const builtinName = sillyString(info.ui_name)

    highlightInfo.add(sillyString(info.hi_name), {
      name,
      builtinName,
      hlid: id,
      id: info.id,
      kind: info.kind,
    })
  })

  ee.emit('highlight-info.added')
}

export const getColorByName = async (name: string): Promise<Color> => {
  const { foreground, background } = await api.nvim.getColorByName(name)
  return {
    foreground: asColor(foreground),
    background: asColor(background),
  }
}

export const getColorById = (id: number): Color => {
  const hlgrp = highlights.get(instances.current, id) || {} as HighlightGroup
  return {
    foreground: hlgrp.foreground,
    background: hlgrp.background,
  }
}

export const highlightLookup = (name: string): HighlightInfo[] => {
  const info = highlightInfo.get(name)
  if (!info) return (console.error('highlight info does not exist for:', name), [])
  return [...info]
}
export const getHighlight = (id: number) => highlights.get(instances.current, id)

export const generateColorLookupAtlas = () => {
  // hlid are 0 indexed, but width starts at 1
  canvas.width = Math.max(...highlights.keys()) + 1
  canvas.height = 3

  const defaultColors = getCurrentDefaultColors()
  ui.imageSmoothingEnabled = false

  highlights.forEach(instances.current, ([ id, hlgrp ]) => {
    const defbg = hlgrp.reverse
      ? defaultColors.foreground
      : defaultColors.background
    ui.fillStyle = hlgrp.background || defbg
    ui.fillRect(id, 0, 1, 1)

    const deffg = hlgrp.reverse
      ? defaultColors.background
      : defaultColors.foreground
    ui.fillStyle = hlgrp.foreground || deffg
    ui.fillRect(id, 1, 1, 1)

    if (!hlgrp.underline) return

    ui.fillStyle = hlgrp.special || defaultColors.special
    ui.fillRect(id, 2, 1, 1)
  })

  return canvas
}

export const getColorAtlas = () => canvas
