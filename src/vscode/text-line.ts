import { Range, Position } from '../vscode/types'
import * as vsc from 'vscode'

export default (lineNumber: number, text: string): vsc.TextLine => {
  const firstNonWhitespaceCharacterIndex = findFirstNonWhitespaceCharIndex(text)
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

const findFirstNonWhitespaceCharIndex = (text: string, startIndex = 0): number => {
  const length = text.length
  for (let ix = startIndex; ix < length; ix++) {
    const char = text.charAt(ix)
    if (char !== ' ' && char !== '\t') return ix
  }
  return length
}
