import * as vsc from 'vscode'

export default (lineNumber: number, text: string): vsc.TextLine => {
  const [ , whitespace] = text.match(/^\s/)
  const firstNonWhitespaceCharacterIndex = text.length - whitespace.length
  const isEmptyOrWhitespace = firstNonWhitespaceCharacterIndex === text.length

  return {
    text,
    lineNumber,
    firstNonWhitespaceCharacterIndex,
    isEmptyOrWhitespace,
  }
}
