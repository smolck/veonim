import { Watchers, merge, throttle } from '../support/utils'
import robotoSizes from '../support/roboto-sizes'
import * as electron from 'electron'
import { setVar } from '../ui/css'

export interface SetFontParams {
  face?: string,
  size?: number,
  lineHeight?: number,
}

export interface Cell {
  height: number
  width: number
  padding: number
}

export interface Font {
  face: string
  size: number
  lineHeight: number
}

export interface Pad {
  x: number
  y: number
}

const watchers = new Watchers()
const container = document.getElementById('workspace') as HTMLElement
const sandboxCanvas = document.createElement('canvas')
const canvas = sandboxCanvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D

merge(container.style, {
  display: 'flex',
  flex: '1',
  position: 'relative',
  background: 'var(--background-30)',
})

export const font: Font = {
  face: 'Roboto Mono Builtin',
  size: 14,
  lineHeight: 1.5,
}

export const pad: Pad = {
  x: 4,
  y: 8,
}

export const cell: Cell = {
  width: 0,
  height: 0,
  padding: 0,
}

export const size = {
  rows: 0,
  cols: 0,
  height: 0,
  width: 0,
  get nameplateHeight() { return cell.height + 4 },
}

const getCharWidth = (font: string, size: number): number => {
  const possibleSize = Math.floor(canvas.measureText('m').width)
  // roboto mono is built-in. because font-loading is a bit slow,
  // we have precomputed most common font sizes in advance
  if (font !== 'Roboto Mono Builtin' && (size > 3 || size < 54)) return possibleSize

  const floatWidth = Reflect.get(robotoSizes, size + '')
  return floatWidth || possibleSize
}

export const setFont = ({ size, lineHeight, face = font.face }: SetFontParams) => {
  const fontSize = !size || isNaN(size) ? font.size : size
  const fontLineHeight = !lineHeight || isNaN(lineHeight) ? font.lineHeight : lineHeight

  setVar('font', face)
  setVar('font-size', fontSize)
  setVar('line-height', fontLineHeight)

  canvas.font = `${fontSize}px ${face}`

  merge(font, { size: fontSize, face, lineHeight: fontLineHeight })
  merge(cell, {
    width: getCharWidth(face, fontSize),
    height: Math.floor(fontSize * fontLineHeight)
  })

  pad.x = Math.round(cell.width / 2)
  pad.y = pad.x + 4

  cell.padding = Math.floor((cell.height - font.size) / 2)

  watchers.notify('font', { ...font })
  watchers.notify('cell', { ...cell })
}

export const resize = () => {
  const { width, height } = container.getBoundingClientRect()
  merge(size, {
    height,
    width,
    rows: Math.floor(height / cell.height) - 1,
    cols: Math.floor(width / cell.width) - 2,
  })

  watchers.notify('resize', size)
}

export const redoResize = (rows: number, cols: number) => {
  merge(size, { rows, cols })
  watchers.notify('resize', size)
}

export const on = (event: string, handler: (data: any) => void) => watchers.add(event, handler)

setFont({})
setImmediate(() => resize())

window.addEventListener('resize', throttle(() => resize(), 150))
window.matchMedia('screen and (min-resolution: 2dppx)').addListener(() => {
  resize()
  watchers.notify('device-pixel-ratio-changed')
})
electron.screen.on('display-added', () => resize())
electron.screen.on('display-removed', () => resize())
electron.screen.on('display-metrics-changed', () => resize())
