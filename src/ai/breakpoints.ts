import { DebugProtocol as DP } from 'vscode-debugprotocol'
import { basename } from 'path'

export enum BreakpointKind {
  Source,
  Function,
  Exception,
}

export interface Breakpoint {
  kind: BreakpointKind
  path: string
  line: number
  column: number
  condition?: string
  functionName?: string
  hitCondition?: string
  logMessage?: string
}

const files = new Map<string, Breakpoint[]>()

// TODO: can we have multiple breakpoints on the path/line/column? like
// conditional breakpoints or logMessage breakpoints?
// if so, then we need to check additional properties for equality comparison
const findBreakpoint = (breakpoint: Breakpoint) => {
  const breakpoints = files.get(breakpoint.path) || []

  const index = breakpoints.findIndex(
    (b) =>
      b.kind === breakpoint.kind &&
      b.path === breakpoint.path &&
      b.line === breakpoint.line &&
      b.column === breakpoint.column
  )

  return {
    exists: index !== -1,
    remove: () => breakpoints.splice(index, 1),
  }
}

export const add = (breakpoint: Breakpoint) =>
  files.has(breakpoint.path)
    ? files.get(breakpoint.path)!.push(breakpoint)
    : files.set(breakpoint.path, [breakpoint])

export const remove = (breakpoint: Breakpoint) => {
  if (!files.has(breakpoint.path)) return
  const { exists, remove } = findBreakpoint(breakpoint)
  if (exists) remove()
}

export const has = (breakpoint: Breakpoint) => findBreakpoint(breakpoint).exists

const asSourceBreakpoint = (breakpoint: Breakpoint): DP.SourceBreakpoint => {
  const { kind, path, functionName, ...rest } = breakpoint
  return rest
}

const asFunctionBreakpoint = (
  breakpoint: Breakpoint
): DP.FunctionBreakpoint => {
  const { functionName: name = '', condition, hitCondition } = breakpoint
  return { name, condition, hitCondition }
}

export const listSourceBreakpoints = () =>
  [...files.entries()].map(([path, allBreakpoints]) => ({
    source: { path, name: basename(path) },
    breakpoints: allBreakpoints
      .filter((b) => b.kind === BreakpointKind.Source)
      .map(asSourceBreakpoint),
  }))

export const listFunctionBreakpoints = () =>
  [...files.entries()].map(([path, allBreakpoints]) => ({
    source: { path, name: basename(path) },
    breakpoints: allBreakpoints
      .filter((b) => b.kind === BreakpointKind.Function)
      .map(asFunctionBreakpoint)
      .filter((b) => b.name),
  }))

export const list = () =>
  [...files.values()].reduce((res, breakpoints) => {
    return [...res, ...breakpoints]
  }, [])
