import { Range, Position } from '../vscode/types'
import * as vsc from 'vscode'

export default (lineNumber: number, text: string): vsc.TextLine => {
  const [ , whitespace ] = text.match(/^\s/) || [] as string[]
  const firstNonWhitespaceCharacterIndex = text.length - whitespace.length
  const isEmptyOrWhitespace = firstNonWhitespaceCharacterIndex === text.length
  const pos = {
    start: new Position(lineNumber, 0),
    end: new Position(lineNumber, text.length),
  }

  const range = new Range(pos.start, pos.end)

  return {
    text,
    range,
    lineNumber,
    rangeIncludingLineBreak: range,
    firstNonWhitespaceCharacterIndex,
    isEmptyOrWhitespace,
  }
}
