import * as workspace from './workspace'
import { listof } from '../support/utils'

type Character = string
type Foreground = string
type Background = string
type Underline = boolean
type UnderlineColor = string
type Cell = [ Character, Foreground, Background, Underline, UnderlineColor ]

let grid: Cell[][] = [[]]

export const defaults = { fg: '', bg: '', sp: '' }
export const setForeground = (fg: string) => defaults.fg = fg
export const setBackground = (bg: string) => defaults.bg = bg
export const setSpecial = (sp: string) => defaults.sp = sp
export const get = (row: number, col: number): Cell => (grid[row] || [])[col] || []
export const getLine = (row: number, start: number, end: number): Cell[] => grid[row].slice(start, end) || []
export const getLines = (row: number, endRow: number): Cell[][] => grid.slice(row, endRow)

type RowNumber = number
type LineData = Cell[]
type FilterResult = [ RowNumber, LineData ]

export const filterLinesOnChar = (fn: (char: string) => boolean) => {
  const maxRows = grid.length
  const maxCols = grid[0].length

  const results: FilterResult[] = []

  for (let yix = 0; yix < maxRows; yix++) {
    const line = grid[yix]

    for (let xix = 0; xix < maxCols; xix++) {
      const thisLineIsAMatch = fn(line[xix][0])

      if (thisLineIsAMatch) {
        results.push([ yix, line ])
        continue
      }
    }
  }

  return results
}

export const resize = (rows: number, columns: number) => {
  grid = listof(rows, () => listof(columns, () => [' ', defaults.fg, defaults.bg, false, defaults.sp] as Cell))
}

export const set = (row: number, col: number, char: string, fg = defaults.fg, bg = defaults.bg, underline = false, underlineColor = defaults.sp) => {
  if (!grid[row] || !grid[row][col]) return
  grid[row][col][0] = char
  grid[row][col][1] = fg
  grid[row][col][2] = bg
  grid[row][col][3] = underline
  grid[row][col][4] = underlineColor
}

export const moveRegionDown = (amt: number, top: number, bottom: number, left: number, right: number) => {
  for (let yix = bottom; yix - amt >= top; yix--) {
    const line = grid[yix]
    const sourceLine = grid[yix - amt]

    for (let xix = left; xix <= right; xix++) {
      if (yix === top) {
        line[xix][0] = ' '
        line[xix][1] = defaults.fg
        line[xix][2] = defaults.bg
        line[xix][3] = false
        line[xix][4] = defaults.sp
      } else {
        if (!sourceLine) continue
        line[xix][0] = sourceLine[xix][0]
        line[xix][1] = sourceLine[xix][1]
        line[xix][2] = sourceLine[xix][2]
        line[xix][3] = sourceLine[xix][3]
        line[xix][4] = sourceLine[xix][4]
        sourceLine[xix][0] = ' '
        sourceLine[xix][1] = defaults.fg
        sourceLine[xix][2] = defaults.bg
        sourceLine[xix][3] = false
        sourceLine[xix][4] = defaults.sp
      }
    }
  }
}

export const moveRegionUp = (amt: number, top: number, bottom: number, left: number, right: number) => {
  for (let yix = top; yix + amt <= bottom; yix++) {
    const line = grid[yix]
    const sourceLine = grid[yix + amt]

    for (let xix = left; xix <= right; xix++) {
      if (yix === bottom) {
        line[xix][0] = ' '
        line[xix][1] = defaults.fg
        line[xix][2] = defaults.bg
        line[xix][3] = false
        line[xix][4] = defaults.sp
      }
      else {
        if (!sourceLine) continue
        line[xix][0] = sourceLine[xix][0]
        line[xix][1] = sourceLine[xix][1]
        line[xix][2] = sourceLine[xix][2]
        line[xix][3] = sourceLine[xix][3]
        line[xix][4] = sourceLine[xix][4]
        sourceLine[xix][0] = ' '
        sourceLine[xix][1] = defaults.fg
        sourceLine[xix][2] = defaults.bg
        sourceLine[xix][3] = false
        sourceLine[xix][4] = defaults.sp
      }
    }
  }
}

export const clear = () => {
  const totalLines = grid.length

  for (let lineIx = 0; lineIx < totalLines; lineIx++) {
    const line = grid[lineIx]
    const lineLength = line.length

    for (let charIx = 0; charIx < lineLength; charIx++) {
      line[charIx][0] = ' '
      line[charIx][1] = defaults.fg
      line[charIx][2] = defaults.bg
      line[charIx][3] = false
      line[charIx][4] = defaults.sp
    }
  }
}

export const clearLine = (row: number, col: number) => {
  const line = grid[row]
  const lineLength = line.length

  for (let charIx = col; charIx < lineLength; charIx++) {
    line[charIx][0] = ' '
    line[charIx][1] = defaults.fg
    line[charIx][2] = defaults.bg
    line[charIx][3] = false
    line[charIx][4] = defaults.sp
  }
}

workspace.on('resize', ({ rows, cols }) => resize(rows, cols))
