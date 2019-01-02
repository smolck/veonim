import { Command, Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-protocol'
import { LocationItem, findNext, findPrevious } from '../support/relative-finder'
import { ProblemHighlight, Highlight, HighlightGroupId } from '../neovim/types'
import { codeAction, onDiagnostics, executeCommand } from '../langserv/adapter'
import { ui as problemInfoUI } from '../components/problem-info'
import { uriToPath, pathRelativeToCwd } from '../support/utils'
import { positionWithinRange } from '../support/neovim-utils'
import * as codeActionUI from '../components/code-actions'
import { supports } from '../langserv/server-features'
import * as problemsUI from '../components/problems'
import * as dispatch from '../messaging/dispatch'
import { setCursorColor } from '../core/cursor'
import { onSwitchVim } from '../core/sessions'
import { sessions } from '../core/sessions'
import { cursor } from '../core/cursor'
import nvim from '../core/neovim'
import '../ai/remote-problems'
import * as path from 'path'

export interface Problem {
  file: string,
  dir: string,
  items: Diagnostic[],
}

type Diags = Map<string, Diagnostic[]>

const cache = {
  diagnostics: new Map<number, Diags>(new Map()),
  problems: new Map<number, Problem[]>(),
  actions: [] as Command[],
  currentBuffer: '',
}

const clearAllDiagnosticsForSource = (source: string) => {
  const sessionDiagnostics = cache.diagnostics.get(sessions.current)
  if (!sessionDiagnostics) return

  const diagValues = [...sessionDiagnostics.entries()]
  const filteredDiagnostics = diagValues.reduce((next, [ path, diagnostics ]) => {
    const cleaned = diagnostics.filter(m => m.source !== source)
    next.set(path, cleaned)
    return next
  }, new Map())

  cache.diagnostics.set(sessions.current, filteredDiagnostics)
}

const updateDiagnostics = (path: string, diagnostics: Diagnostic[]) => {
  const sessionDiagnostics = cache.diagnostics.get(sessions.current)
  if (sessionDiagnostics) return sessionDiagnostics.set(path, diagnostics)
  const newSessionDiags = new Map([ [ path, diagnostics ] ])
  cache.diagnostics.set(sessions.current, newSessionDiags)
}

const current = {
  get diagnostics(): Diags { return cache.diagnostics.get(sessions.current) || new Map() },
  get problems(): Problem[] { return cache.problems.get(sessions.current) || [] },
}

const updateUI = () => {
  const problems = mapAsProblems(current.diagnostics)
  problemsUI.update(problems)
}

const mapAsProblems = (diagsMap: Map<string, Diagnostic[]>): Problem[] =>
  [...diagsMap.entries()]
  .map(([ filepath, diagnostics ]) => ({
    items: diagnostics,
    file: path.basename(pathRelativeToCwd(filepath, nvim.state.cwd)),
    dir: path.dirname(pathRelativeToCwd(filepath, nvim.state.cwd)),
  }))
  .filter(m => m.items.length)

const getDiagnosticLocations = (diags: Map<string, Diagnostic[]>): LocationItem[] => [...diags.entries()]
  .reduce((res, [ path, diagnostics ]) => {
    const pathDiags = diagnostics.map(d => ({
      path,
      line: d.range.start.line,
      column: d.range.start.character,
      endLine: d.range.end.line,
      endColumn: d.range.end.character,
    }))

    return [...res, ...pathDiags]
  }, [] as LocationItem[])

const getProblemCount = (diagsMap: Map<string, Diagnostic[]>) => {
  const diagsList = [...diagsMap.values()]
  if (!diagsList.length) return { errors: 0, warnings: 0 }

  const diagnostics = diagsList.reduce((all, curr) => all.concat(curr))
  const errors = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error).length
  const warnings = diagnostics.filter(d => d.severity === DiagnosticSeverity.Warning).length
  return { errors, warnings }
}

export const addQF = (items: Map<string, Diagnostic[]>, source: string) => {
  clearAllDiagnosticsForSource(source)
  items.forEach((diags, loc) => updateDiagnostics(loc, diags))
  dispatch.pub('ai:diagnostics.count', getProblemCount(current.diagnostics))
  updateUI()
}

const refreshProblemHighlights = async () => {
  const currentBufferPath = path.join(nvim.state.cwd, nvim.state.file)
  const diagnostics = current.diagnostics.get(currentBufferPath) || []
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

export const showProblem = async () => {
  const { line, column, cwd, file } = nvim.state
  const diagnostics = current.diagnostics.get(path.join(cwd, file))
  if (!diagnostics) return

  const targetProblem = diagnostics.find(d => positionWithinRange(line, column, d.range))
  if (targetProblem) problemInfoUI.show(targetProblem.message)
}

nvim.onAction('show-problem', showProblem)

nvim.on.cursorMove(problemInfoUI.hide)
nvim.on.insertLeave(problemInfoUI.hide)
nvim.on.insertEnter(problemInfoUI.hide)

nvim.onAction('next-problem', async () => {
  const { line, column, cwd, file } = nvim.state
  const currentPath = path.join(cwd, file)
  const diagnosticLocations = getDiagnosticLocations(current.diagnostics)
  if (!diagnosticLocations) return

  const problem = findNext(diagnosticLocations, currentPath, line, column)
  if (!problem) return

  nvim.jumpTo(problem)
})

nvim.onAction('prev-problem', async () => {
  const { line, column, cwd, file } = nvim.state
  const currentPath = path.join(cwd, file)
  const diagnosticLocations = getDiagnosticLocations(current.diagnostics)
  if (!diagnosticLocations) return

  const problem = findPrevious(diagnosticLocations, currentPath, line, column)
  if (!problem) return

  nvim.jumpTo(problem)
})

nvim.onAction('problems-toggle', () => problemsUI.toggle())
nvim.onAction('problems-focus', () => problemsUI.focus())

export const openProblems = () => problemsUI.focus()

export const setProblems = (problems: Problem[]) => {
  if (!problems || !problems.length) return
  cache.problems.set(sessions.current, problems)
  updateUI()
}

nvim.on.cursorMove(async () => {
  const { line, column, cwd, file, filetype } = nvim.state
  const diagnostics = current.diagnostics.get(path.join(cwd, file))
  if (!diagnostics) return

  const relevantDiagnostics = diagnostics
    .filter(d => positionWithinRange(line, column, d.range))

  if (!supports.codeActions(cwd, filetype)) return
  const actions = await codeAction(nvim.state, relevantDiagnostics)

  if (actions && actions.length) {
    cache.actions = actions
    setCursorColor('red')
  }
})

export const runCodeAction = (action: Command) => executeCommand(nvim.state, action)

export const showCodeActions = () => codeActionUI.show(cursor.row, cursor.col, cache.actions)

nvim.onAction('code-action', showCodeActions)

onDiagnostics(async m => {
  const path = uriToPath(m.uri)
  cache.currentBuffer = path
  updateDiagnostics(path, m.diagnostics)
  dispatch.pub('ai:diagnostics.count', getProblemCount(current.diagnostics))
  if (cache.diagnostics.size) updateUI()
  refreshProblemHighlights()
})

onSwitchVim(() => {
  dispatch.pub('ai:diagnostics.count', getProblemCount(current.diagnostics))
  updateUI()
  refreshProblemHighlights()
})
