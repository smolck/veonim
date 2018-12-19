import * as canvasContainer from './workspace'

interface CharPosition {
  x: number,
  y: number,
}

interface FontAtlas {
  getCharPosition(char: string, color: string): CharPosition | undefined,
  bitmap: ImageBitmap,
}

const CHAR_START = 32
const CHAR_END = 127
const canvas = document.createElement('canvas')
const ui = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D

let atlas: FontAtlas

const generate = async (colors: string[]): Promise<FontAtlas> => {
  if (!colors.length) throw new Error('cannot generate font atlas because no colors were given')
  const colorLines = new Map<string, number>()

  const drawChar = (col: number, y: number, char: string) => {
    const { height, width } = canvasContainer.cell

    ui.save()
    ui.beginPath()
    ui.rect(col * width, y, width, height)
    ui.clip()
    ui.fillText(char, col * width, y)
    ui.restore()
  }

  const drawCharLine = (color: string, row: number) => {
    ui.fillStyle = color

    let column = 0
    for (let ix = CHAR_START; ix < CHAR_END; ix++) {
      drawChar(column, row, String.fromCharCode(ix))
      column++
    }
  }

  const height = canvasContainer.cell.height * colors.length
  const width = (CHAR_END - CHAR_START) * canvasContainer.cell.width

  canvas.height = height * window.devicePixelRatio
  canvas.width = width * window.devicePixelRatio

  ui.imageSmoothingEnabled = false
  ui.font = `${canvasContainer.font.size}px ${canvasContainer.font.face}`
  ui.scale(window.devicePixelRatio, window.devicePixelRatio)
  ui.textBaseline = 'top'

  colors.reduce((currentRow, color) => {
    drawCharLine(color, currentRow)
    colorLines.set(color, currentRow)
    return currentRow + canvasContainer.cell.height
  }, 0)

  const getCharPosition = (char: string, color: string) => {
    const code = char.charCodeAt(0)
    if (code < CHAR_START || code > CHAR_END) return
    const srcRow = colorLines.get(color)
    if (typeof srcRow !== 'number') return
    const x = (code - CHAR_START) * canvasContainer.cell.width * window.devicePixelRatio
    const y = srcRow * window.devicePixelRatio
    return { x, y }
  }

  return {
    getCharPosition,
    bitmap: await createImageBitmap(canvas),
  }
}

export default {
  get exists() { return !!atlas },
  get bitmap() { return (atlas || {}).bitmap },
  generate: (colors: string[]) => generate(colors).then(fa => atlas = fa),
  getCharPosition: (char: string, color: string) => {
    if (!atlas) return
    return atlas.getCharPosition(char, color)
  },
}
