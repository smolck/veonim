import { LocationItem, findNext, findPrevious } from '../support/relative-finder'
import { ProblemHighlight, Highlight, HighlightGroupId } from '../neovim/types'
import { positionWithinRange } from '../support/neovim-utils'
import { DiagnosticSeverity } from '../vscode/types'
import { Diagnostic, CodeAction } from 'vscode'
import { vscode } from '../core/extensions-api'
import { PromiseBoss } from '../support/utils'
import nvim from '../neovim/api'
import { ui } from '../core/ai'

const boss = PromiseBoss()

const cache = {
  problems: [] as Diagnostic[],
  actions: [] as CodeAction[],
}

const getDiagnosticLocations = (diagnostics: Diagnostic[]): LocationItem[] => diagnostics.map(d => ({
  path: nvim.state.absoluteFilepath,
  range: d.range,
}))

const getProblemCount = (diagnostics: Diagnostic[]) => {
  const errors = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error).length
  const warnings = diagnostics.filter(d => d.severity === DiagnosticSeverity.Warning).length
  return { errors, warnings }
}

const refreshProblemHighlights = async (diagnostics: Diagnostic[]) => {
  const buffer = nvim.current.buffer

  if (!diagnostics.length) return buffer.clearHighlight(HighlightGroupId.Diagnostics, 0, -1)

  const problems: ProblemHighlight[] = diagnostics.map(d => ({
    id: HighlightGroupId.Diagnostics,
    group: Highlight.Undercurl,
    line: d.range.start.line,
    columnStart: d.range.start.character,
    columnEnd: d.range.end.character,
  }))

  buffer.highlightProblems(problems)
}

nvim.onAction('show-problem', async () => {
  const { line, column } = nvim.state
  const targetProblem = cache.problems.find(d => positionWithinRange(line, column, d.range))
  if (targetProblem) ui.problemInfo.show(targetProblem.message)
})

nvim.on.cursorMove(() => ui.problemInfo.hide())
nvim.on.insertLeave(() => ui.problemInfo.hide())
nvim.on.insertEnter(() => ui.problemInfo.hide())

nvim.onAction('next-problem', async () => {
  const diagnosticLocations = getDiagnosticLocations(cache.problems)
  const problem = findNext(diagnosticLocations, nvim.state.absoluteFilepath, nvim.state.line, nvim.state.column)
  if (!problem) return

  nvim.jumpTo({
    path: problem.path,
    line: problem.range.start.line,
    column: problem.range.start.character,
  })
})

nvim.onAction('prev-problem', async () => {
  const diagnosticLocations = getDiagnosticLocations(cache.problems)
  const problem = findPrevious(diagnosticLocations, nvim.state.absoluteFilepath, nvim.state.line, nvim.state.column)
  if (!problem) return

  nvim.jumpTo({
    path: problem.path,
    line: problem.range.start.line,
    column: problem.range.start.character,
  })
})

nvim.onAction('problems-toggle', () => ui.problems.toggle())
nvim.onAction('problems-focus', () => ui.problems.focus())

nvim.on.cursorMove(async () => {
  const { line, column } = nvim.state
  const relevantDiagnostics = cache.problems.filter(d => positionWithinRange(line, column, d.range))
  const actions = await boss.schedule(vscode.language.provideCodeActions({ diagnostics: relevantDiagnostics }), { timeout: 10e3 })
  cache.actions = actions || [] as CodeAction[]
})

export const runCodeAction = (action: CodeAction) => {
  if (action.command) vscode.commands.executeCommand(action.command.command, ...(action.command.arguments || []))
  // TODO: run other kinds of code actions besides command
  else console.warn('NYI: codeAction do other actions besides Commands')
}

nvim.onAction('code-action', async () => {
  const { row, col } = await nvim.getCursorPosition()
  ui.codeAction.show(row, col, cache.actions)
})

vscode.onDiagnostics(event => {
  if (!event.length) return
  // TODO: WHAT DO if we have multiple uris? i thought langserv only supported current file
  // maybe with vscode extensions they do something more fancy and support multiple.
  // could also be that we get diagnostics for the same uri from multiple extensions
  // TODO: in the extension host did we check if we get duplicate uris in the event?
  const res = event.find(m => m.path === nvim.state.absoluteFilepath)
  if (!res) return console.error('did not receive any diagnostics for the current file', event)
  cache.problems = res.diagnostics
  refreshProblemHighlights(res.diagnostics)
  ui.problemCount.update(getProblemCount(res.diagnostics))
  // TODO: i don't care about the problems panel right now. i will revisit
  // when we get compiler output. i never use the problems panel
  // ui.problems.update(diagnostics)
})
