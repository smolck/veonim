import { Command, Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-protocol'
import { LocationItem, findNext, findPrevious } from '../support/relative-finder'
import { ProblemHighlight, Highlight, HighlightGroupId } from '../neovim/types'
import { codeAction, onDiagnostics, executeCommand } from '../langserv/adapter'
import { positionWithinRange } from '../support/neovim-utils'
import { supports } from '../langserv/server-features'
import nvim from '../neovim/api'
import { ui } from '../core/ai'

const cache = {
  problems: [] as Diagnostic[],
  actions: [] as Command[],
}

const getDiagnosticLocations = (diagnostics: Diagnostic[]): LocationItem[] => diagnostics.map(d => ({
  path: nvim.state.absoluteFilepath,
  line: d.range.start.line,
  column: d.range.start.character,
  endLine: d.range.end.line,
  endColumn: d.range.end.character,
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

  nvim.jumpTo(problem)
})

nvim.onAction('prev-problem', async () => {
  const diagnosticLocations = getDiagnosticLocations(cache.problems)
  const problem = findPrevious(diagnosticLocations, nvim.state.absoluteFilepath, nvim.state.line, nvim.state.column)
  if (!problem) return

  nvim.jumpTo(problem)
})

nvim.onAction('problems-toggle', () => ui.problems.toggle())
nvim.onAction('problems-focus', () => ui.problems.focus())

nvim.on.cursorMove(async () => {
  const { line, column, cwd, filetype } = nvim.state

  const relevantDiagnostics = cache.problems
    .filter(d => positionWithinRange(line, column, d.range))

  if (!supports.codeActions(cwd, filetype)) return
  cache.actions = await codeAction(nvim.state, relevantDiagnostics)
})

export const runCodeAction = (action: Command) => executeCommand(nvim.state, action)

nvim.onAction('code-action', async () => {
  const { row, col } = await nvim.getCursorPosition()
  ui.codeAction.show(row, col, cache.actions)
})

onDiagnostics(({ diagnostics }) => {
  cache.problems = diagnostics
  refreshProblemHighlights(diagnostics)
  ui.problemCount.update(getProblemCount(diagnostics))
  // TODO: i don't care about the problems panel right now. i will revisit
  // when we get compiler output. i never use the problems panel
  // ui.problems.update(diagnostics)
})
