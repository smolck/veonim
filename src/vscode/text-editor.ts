import { Position, Range, Selection, TextEditorLineNumbersStyle, ViewColumn, EndOfLine } from '../vscode/types'
import TextDocument from '../vscode/text-document'
import nvimSync from '../neovim/sync-api-client'
import { CreateTask } from '../support/utils'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

const TextEditor = (winid: number): vsc.TextEditor => ({
  get document() {
    const bufid = nvimSync(async (nvim, id) => {
      const buf = await nvim.Window(id).buffer
      return buf.id
    }).call(winid)

    return TextDocument(bufid)
  },
  // this only works for the current active window
  get selection() {
    const { start, end } = nvimSync(async (nvim) => {
      const [ start, end ] = await Promise.all([
        nvim.call.getpos(`'<`),
        nvim.call.getpos(`'>`),
      ])
      return { start, end }
    }).call()

    const [ /*bufnum*/, startLine, startCol ] = start
    const [ /*bufnum*/, endLine, endCol ] = end

    const isVisualLineMode = startCol === 0

    const anchor = new Position(startLine, isVisualLineMode ? 0 : startCol - 1)
    const active = isVisualLineMode
      ? new Position(endLine + 1, 0)
      : new Position(endLine, endCol - 1)

    return new Selection(anchor, active)
  },
  // nvim does not support multiple selections, but we should classify visual
  // block mode as multiple selections. (also only work for current window)
  // TODO: how to determine visual block mode and breakup selections
  get selections() {
    const { start, end } = nvimSync(async (nvim) => {
      const [ start, end ] = await Promise.all([
        nvim.call.getpos(`'<`),
        nvim.call.getpos(`'>`),
      ])
      return { start, end }
    }).call()

    const [ /*bufnum*/, startLine, startCol ] = start
    const [ /*bufnum*/, endLine, endCol ] = end

    const isVisualLineMode = startCol === 0

    const anchor = new Position(startLine, isVisualLineMode ? 0 : startCol - 1)
    const active = isVisualLineMode
      ? new Position(endLine + 1, 0)
      : new Position(endLine, endCol - 1)

    return [ new Selection(anchor, active) ]
  },
  // this only works for the current active window
  get visibleRanges() {
    const top = new Position(nvim.state.editorTopLine, 0)
    const bottom = new Position(nvim.state.editorBottomLine + 1, 0)
    return [ new Range(top, bottom) ]
  },
  viewColumn: ViewColumn.One,
  get options() {
    const { number, relativeNumber, tabstop, expandtab } = nvimSync(async (nvim, id) => {
      const win = nvim.Window(id)
      const [ number, relativeNumber, tabstop, expandtab ] = await Promise.all([
        win.getOption('number'),
        win.getOption('relativenumber'),
        nvim.options.tabstop,
        nvim.options.expandtab,
      ])
      return { number, relativeNumber, tabstop, expandtab }
    }).call(winid)

    return {
      tabSize: tabstop,
      insertSpaces: !!expandtab,
      cursorStyle: 2, // block
      lineNumbers: relativeNumber
        ? TextEditorLineNumbersStyle.Relative
        : number ? TextEditorLineNumbersStyle.On : TextEditorLineNumbersStyle.Off,
    }
  },
  // TODO: do something with the options?
  edit: editFn => {
    const editTask = CreateTask()
    let transactionComplete = false
    const fin = () => {
      transactionComplete = true
      editTask.done(true)
    }

    const editBuilder: vsc.TextEditorEdit = {
      replace: async (location, value) => {
        if (transactionComplete) return
        const buffer = await nvim.Window(winid).buffer

        const start = {
          line: location instanceof Position
            ? location.line
            : (location as Range).start.line,
          column: location instanceof Position
            ? location.character
            : (location as Range).start.character,
        }

        const end = {
          line: location instanceof Position
            ? location.line
            : (location as Range).end.line,
          column: location instanceof Position
            ? location.character
            : (location as Range).end.character,
        }

        buffer.replaceRange(start.line, start.column, end.line, end.column, value)
        fin()
      },
      insert: async (location, value) => {
        if (transactionComplete) return
        const buffer = await nvim.Window(winid).buffer
        buffer.appendRange(location.line, location.character, value)
        fin()
      },
      delete: async ({ start, end }) => {
        if (transactionComplete) return
        const buffer = await nvim.Window(winid).buffer
        buffer.deleteRange(start.line, start.character, end.line, end.character)
        fin()
      },
      setEndOfLine: eol => {
        if (transactionComplete) return
        const fileformat = eol === EndOfLine.LF ? 'unix' : 'dos'
        nvim.current.buffer.setOption('fileformat', fileformat)
        fin()
      },
    }

    editFn(editBuilder)
    return editTask.promise as Promise<boolean>
  },
  // TODO: i want to wait for extended marks before implementing snippets
  insertSnippet: () => {
    console.warn('NYI: textEditor.insertSnippet')
    return Promise.resolve(false)
  },
  // TODO: what are decorations? the references/git blame stuff in the editor?
  // we could use the nvim virtual text annotations?
  setDecorations: () => {
    console.warn('NYI: textEditor.setDecorations')
    // nvim.current.buffer.addVirtualText()
  },
  // only works for current window
  revealRange: range => {
    nvim.jumpTo({ line: range.start.line, column: range.start.character })
  },
  show: () => console.warn('DEPRECATED: use window.showTextDocument'),
  hide: () => console.warn('DEPRECATED: use workbench.action.closeActiveEditor'),
})

export default (winid: number) => {
  if (typeof winid !== 'number') {
    console.error('invalid TextEditor window id:', winid)
    throw new Error('can not create TextEditor without a window id NUMBER')
  }

  return TextEditor(winid)
}
