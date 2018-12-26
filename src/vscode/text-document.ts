import filetypeToVSCLanguage from '../langserv/vsc-languages'
import { Position, Range } from '../vscode/types'
import nvimSync from '../neovim/sync-api-client'
import { BufferOption } from '../neovim/types'
import TextLine from '../vscode/text-line'
import { is } from '../support/utils'
import { URI } from '../vscode/uri'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

// TODO:
// - requestSync with func context works
// - nvim write with bufdo works
// - write tests

export default (bufid: number): vsc.TextDocument => ({
  get isUntitled() {
    const name = nvimSync((nvim, id) => {
      return nvim.Buffer(id).name
    }).withArgs(bufid)

    return !name
  },
  get uri() {
    const name = nvimSync((nvim, id) => {
      return nvim.Buffer(id).name
    }).withArgs(bufid)

    return URI.file(name)
  },
  get fileName() {
    return nvimSync((nvim, id) => {
      return nvim.Buffer(id).name
    }).withArgs(bufid)
  },
  get languageId() {
    const filetype: string = nvimSync((nvim, id) => {
      return nvim.Buffer(id).getOption(BufferOption.Filetype)
    }).withArgs(bufid)

    return filetypeToVSCLanguage(filetype)
  },
  get version() {
    return nvimSync((nvim, id) => {
      return nvim.Buffer(id).changedtick
    }).withArgs(bufid)
  },
  get isDirty() {
    return !!nvimSync((nvim, id) => {
      return nvim.Buffer(id).getOption(BufferOption.Modified)
    }).withArgs(bufid)
  },
  get isClosed() {
    return !nvimSync((nvim, id) => nvim.Buffer(id).isLoaded()).withArgs(bufid)
  },
  get lineCount() {
    return nvimSync((nvim, id) => {
      return nvim.Buffer(id).length
    }).withArgs(bufid)
  },
  get eol() {
    const eol = nvimSync((nvim, id) => {
      return nvim.Buffer(id).getOption(BufferOption.FileFormat)
    }).withArgs(bufid)

    return eol === 'dos'
      ? vsc.EndOfLine.CRLF
      : vsc.EndOfLine.LF
  },
  save: () => nvim.Buffer(bufid).write(),
  lineAt: (lineOrPosition: number | vsc.Position) => {
    const line = is.number(lineOrPosition)
      ? lineOrPosition as number
      : (lineOrPosition as vsc.Position).line

    const lineData = nvimSync((nvim, id, line) => {
      return nvim.Buffer(id).getLine(line)
    }).withArgs(bufid, line)

    return TextLine(line, lineData)
  },
  offsetAt: position => {
    const lineByteCount: number = nvimSync((nvim, id, line) => {
      return nvim.Buffer(id).bufdo(`call line2byte(${line})`)
    }).withArgs(bufid, position.line)

    return lineByteCount + position.character - 1
  },
  positionAt: offset => {
    const lineNumber: number = nvimSync((nvim, id, offset) => {
      return nvim.Buffer(id).bufdo(`call byte2line(${offset})`)
    }).withArgs(bufid, offset)

    const lineByteCount: number = nvimSync((nvim, id, line) => {
      return nvim.Buffer(id).bufdo(`call line2byte(${line})`)
    }).withArgs(bufid, lineNumber)

    const column = offset - lineByteCount

    return new Position(lineNumber, column)
  },
  getText: range => {
    if (!range) {
      const lines = nvimSync((nvim, id) => nvim.Buffer(id).getAllLines()).withArgs(bufid)
      return lines.join('\n')
    }

    const lines = nvimSync((nvim, id, start, end) => {
      return nvim.Buffer(id).getLines(start, end)
    }).withArgs(bufid, range.start.line, range.end.line)

    const selection = [
      lines[0].slice(range.start.character),
      ...lines.slice(1, -1),
      lines[lines.length - 1].slice(0, range.end.character),
    ]

    return selection.join('\n')
  },
  getWordRangeAtPosition: (position, regex) => {
    // TODO: NYI
    console.warn('NYI: getWordRangeAtPosition', position, regex)
  },
  // assumes given range starts a line:0, character: 0
  validateRange: range => {
    const lineText = nvimSync((nvim, id, line) => {
      return nvim.Buffer(id).getLine(line)
    }).withArgs(bufid, range.end.line)

    if (!lineText) {
      const lineCount = nvimSync((nvim, id) => nvim.Buffer(id).length).withArgs(bufid)
      const lastLine = nvimSync((nvim, id, line) => nvim.Buffer(id).getLine(line)).withArgs(bufid)

      return new Range(
        new Position(range.start.line, range.start.character),
        new Position(lineCount, lastLine.length)
      )
    }

    if (lineText.length > range.end.character) return range

    return new Range(
      new Position(range.start.line, range.start.character),
      new Position(range.end.line, lineText.length),
    )
  },
})
