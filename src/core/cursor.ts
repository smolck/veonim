import { hexToRGBA, partialFill, translate } from '../ui/css'
import * as canvasContainer from '../core/canvas-container'
import { SHADOW_BUFFER_TYPE } from '../support/constants'
import { getWindow, RenderWindow } from '../core/windows'
import { CanvasWindow } from '../core/canvas-window'
import { merge } from '../support/utils'
import { get } from '../core/grid'

export enum CursorShape {
  block,
  line,
  underline,
}

export const cursor = { row: 0, col: 0, color: '#fff', type: CursorShape.block }
const cursorEl = document.getElementById('cursor') as HTMLElement
const cursorChar = document.createElement('span')
const cursorline = document.getElementById('cursorline') as HTMLElement
export const debugline = document.getElementById('debugline') as HTMLElement
let cursorRequestedToBeHidden = false
let cursorEnabled = true

merge(cursorline.style, {
  position: 'absolute',
  mixBlendMode: 'screen',
  height: `${canvasContainer.cell.height}px`,
  zIndex: 60,
})

merge(debugline.style, {
  display: 'none',
  position: 'absolute',
  mixBlendMode: 'screen',
  height: `${canvasContainer.cell.height}px`,
  zIndex: 60,
})

merge(cursorEl.style, {
  zIndex: 70,
  position: 'absolute',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
})

cursorChar.style.filter = 'invert(1) grayscale(1)'
cursorEl.appendChild(cursorChar)


export const getCursorBoundingClientRect = () => cursorline.getBoundingClientRect()

export const setCursorShape = (type: CursorShape, size = 20) => {
  cursor.type = type

  if (type === CursorShape.block) merge(cursorEl.style, {
    background: cursor.color,
    height: `${canvasContainer.cell.height}px`,
    width: `${canvasContainer.cell.width}px`,
  })

  if (type === CursorShape.line) merge(cursorEl.style, {
    background: cursor.color,
    height: `${canvasContainer.cell.height}px`,
    width: `${(canvasContainer.cell.width * (size / 100)).toFixed(2)}px`
  })

  if (type === CursorShape.underline) merge(cursorEl.style, {
    background: partialFill('horizontal', cursor.color, size),
    height: `${canvasContainer.cell.height}px`,
    width: `${canvasContainer.cell.width}px`,
  })
}

export const setCursorColor = (color: string) => {
  cursorChar.style.color = color
  cursor.color = color
  cursorEl.style.background = color
}

export const enableCursor = () => cursorEnabled = true
export const disableCursor = () => cursorEnabled = false

export const hideCursor = () => {
  if (!cursorEnabled) return

  cursorRequestedToBeHidden = true
  cursorEl.style.display = 'none'
  cursorline.style.display = 'none'
}

export const showCursor = () => {
  if (!cursorEnabled) return

  cursorRequestedToBeHidden = false
  cursorEl.style.display = 'flex'
  cursorline.style.display = ''
}

export const showCursorline = () => cursorline.style.display = ''

const updateCursorlinePosition = (canvas: CanvasWindow, backgroundColor: string) => {
  const { x, y, width } = canvas.whereLine(cursor.row)

  merge(cursorline.style, {
    background: hexToRGBA(backgroundColor, 0.2),
    transform: translate(x, y),
    width: `${width}px`,
    height: `${canvasContainer.cell.height}px`,
  })
}

const updateCursorChar = (shape: CursorShape) => {
  if (shape === CursorShape.block) {
    const [ char ] = get(cursor.row, cursor.col)
    cursorChar.innerText = char
    cursorChar.style.display = ''
  }
  else {
    cursorChar.style.display = 'none'
    cursorChar.innerText = ''
  }
}

const controlCursorIfShadowBuffer = (win: RenderWindow) => {
  const isShadowBuffer = win.filetype === SHADOW_BUFFER_TYPE

  if (isShadowBuffer) return cursorEl.style.display = 'none'
  else cursorEl.style.display = 'flex'
}

const updateCursorPosition = (canvas: CanvasWindow) => {
  const { x, y } = canvas.getCursorPosition(cursor.row, cursor.col)
  cursorEl.style.transform = translate(x, y)
}

export const moveCursor = (backgroundColor: string) => {
  const res = getWindow(cursor.row, cursor.col, { getStuff: true })
  if (!res || !res.canvas) return
  const { canvas, win } = res

  // even if cursor(line) is hidden, we still need to update the positions.
  // once the cursor elements are re-activated, the position updated while
  // hidden must be accurate. (e.g. using jumpTo() in grep/references/etc)

  updateCursorPosition(canvas)
  updateCursorlinePosition(canvas, backgroundColor)

  if (!cursorEnabled) return
  if (cursorRequestedToBeHidden) return

  controlCursorIfShadowBuffer(win)
  updateCursorChar(cursor.type)
  showCursorline()
}

setCursorShape(CursorShape.block)
