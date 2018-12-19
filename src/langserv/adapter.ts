import { CodeLens, Diagnostic, Command, Location, WorkspaceEdit, Hover,
  SignatureHelp, SymbolInformation, SymbolKind, CompletionItem,
  DocumentHighlight } from 'vscode-languageserver-protocol'
import { notify, request, setTextSyncState, onDiagnostics as onDiags } from '../langserv/director'
import { is, merge, uriToPath, uriAsCwd, uriAsFile } from '../support/utils'
import { Patch, workspaceEditToPatch } from '../langserv/patch'
import { getLines } from '../support/get-file-contents'
import { NeovimState } from '../neovim/state'
import nvim from '../neovim/api'

export interface Reference {
  path: string,
  line: number,
  column: number,
  endLine: number,
  endColumn: number,
  lineContents: string,
}

export interface EditorLocation {
  path?: string
  line?: number
  column?: number
}

export interface Symbol {
  name: string,
  kind: SymbolKind,
  location: VimLocation,
  containerName?: string,
}

interface HoverResult {
  value?: string,
  doc?: string,
}

interface VimLocation {
  cwd: string,
  file: string,
  position: VimPosition,
}

interface MarkedStringPart {
  language: string,
  value: string,
}

interface VimPosition {
  line: number,
  column: number,
}

// TODO: get typings for valid requests?
const toProtocol = (data: NeovimState, more?: any) => {
  const { cwd, filetype, absoluteFilepath, line, column: character, revision } = data
  const uri = `file://${absoluteFilepath}`

  const base = {
    cwd,
    filetype,
    textDocument: {
      uri,
      version: revision,
    }
  }

  const positionExists = is.number(line) && is.number(character)
  if (positionExists) merge(base, { position: { line, character } })
  return more ? merge(base, more) : base
}

const pauseTextSync = (pauseState: boolean) => {
  const { cwd, filetype } = nvim.state
  setTextSyncState(pauseState, { cwd, filetype })
}

export const textSync = {
  pause: () => pauseTextSync(true),
  resume: () => pauseTextSync(false),
}

// this trickery is because sometimes (randomly) director.onDiagnostics was undefined?!
export const onDiagnostics: typeof onDiags = (a: any) => onDiags(a)

export const definition = async (data: NeovimState): Promise<EditorLocation> => {
  const req = toProtocol(data)
  const result = await request('textDocument/definition', req)
  if (!result || !result.length) return {}
  const { uri, range } = is.array(result) ? result[0] : result

  return {
    path: uriToPath(uri),
    line: range.start.line,
    column: range.start.character,
  }
}

export const typeDefinition = async (data: NeovimState): Promise<EditorLocation> => {
  const req = toProtocol(data)
  const result = await request('textDocument/typeDefinition', req)
  if (!result || !result.length) return {}
  const { uri, range } = is.array(result) ? result[0] : result

  return {
    path: uriToPath(uri),
    line: range.start.line,
    column: range.start.character,
  }
}

export const implementation = async (data: NeovimState): Promise<EditorLocation> => {
  const req = toProtocol(data)
  const result = await request('textDocument/implementation', req)
  if (!result || !result.length) return {}
  const { uri, range } = is.array(result) ? result[0] : result

  return {
    path: uriToPath(uri),
    line: range.start.line,
    column: range.start.character,
  }
}

const getLocationContentsMap = async (locations: Location[]) => {
  const locationsGroupedByPath = locations.reduce((group, ref) => {
    const path = uriToPath(ref.uri)
    const lineNumber = ref.range.start.line

    group.has(path)
      ? group.get(path)!.push(lineNumber)
      : group.set(path, [ lineNumber ])

    return group
  }, new Map<string, number[]>())

  const locationsWithContentRequests = [...locationsGroupedByPath.entries()]
    .map(async ([ path, lineNumbers ]) => ({
      path,
      lineContents: await getLines(path, lineNumbers),
    }))

  const locationsWithContents = await Promise.all(locationsWithContentRequests)

  return locationsWithContents.reduce((map, { path, lineContents }) => {
    lineContents.forEach(({ ix, line }) => map.set(`${path}:${ix}`, line))
    return map
  }, new Map<string, string>())
}

export const references = async (data: NeovimState) => {
  const req = toProtocol(data, {
    context: {
      includeDeclaration: true
    }
  })

  const references: Location[] = await request('textDocument/references', req) || []
  if (!references.length) return { keyword: '', references: [] as Reference[] }

  const locationContentMap = await getLocationContentsMap(references)

  const mappedReferences: Reference[] = references.map(ref => {
    const path = uriToPath(ref.uri)
    const line = ref.range.start.line

    return {
      path,
      line,
      column: ref.range.start.character,
      endLine: ref.range.end.line,
      endColumn: ref.range.end.character,
      lineContents: locationContentMap.get(`${path}:${line}`) || ''
    }
  })

  const [ ref1 ] = mappedReferences

  return {
    references: mappedReferences,
    keyword: ref1.lineContents.slice(ref1.column, ref1.endColumn),
  }
}

export const highlights = async (data: NeovimState) => {
  const req = toProtocol(data)
  const result = await request('textDocument/documentHighlight', req) as DocumentHighlight[]
  if (!result) return { references: [] as Reference[] }

  const references = result.map(m => ({
    lineContents: '',
    line: m.range.start.line,
    column: m.range.start.character,
    endLine: m.range.end.line,
    endColumn: m.range.end.character,
    path: data.absoluteFilepath,
  }))

  return {
    references,
    keyword: '',
  }
}

export const rename = async (data: NeovimState & { newName: string }): Promise<Patch[]> => {
  const req = toProtocol(data, { newName: data.newName })
  const workspaceEdit = await request('textDocument/rename', req) as WorkspaceEdit
  return workspaceEditToPatch(workspaceEdit)
}

export const hover = async (data: NeovimState): Promise<HoverResult> => {
  const req = toProtocol(data)
  const res = await request('textDocument/hover', req) as Hover
  if (!res) return {}
  const { contents } = res

  if (is.string(contents)) return { value: (contents as string) }
  if (is.object(contents)) return { value: (contents as MarkedStringPart).value }
  if (is.array(contents)) return (contents as MarkedStringPart[]).reduce((obj: HoverResult, m: any, ix) => {
    if (is.object(m)) obj.value = m.value
    // i think the documentation is in the 3rd place... maybe wrong
    else if (is.string(m) && ix === 2) obj.doc = m
    return obj
  }, { value: '', doc: '' } as HoverResult)

  return {}
}

const toVimLocation = ({ uri, range }: Location): VimLocation => ({
  cwd: uriAsCwd(uri),
  file: uriAsFile(uri),
  position: {
    line: range.start.line,
    column: range.start.character,
  },
})

export const symbols = async (data: NeovimState): Promise<Symbol[]> => {
  const req = toProtocol(data)
  const symbols = await request('textDocument/documentSymbol', req) as SymbolInformation[]
  if (!symbols || !symbols.length) return []
  return symbols.map(s => ({ ...s, location: toVimLocation(s.location) }))
}

export const workspaceSymbols = async (data: NeovimState, query: string): Promise<Symbol[]> => {
  const req = { query, ...toProtocol(data) }
  const symbols = await request('workspace/symbol', req) as SymbolInformation[]
  if (!symbols || !symbols.length) return []
  return symbols.map(s => ({ ...s, location: toVimLocation(s.location) }))
}

export const completions = async (data: NeovimState): Promise<CompletionItem[]> => {
  const req = toProtocol(data)
  const res = await request('textDocument/completion', req)
  // TODO: handle isIncomplete flag in completions result
  // docs: * This list it not complete. Further typing should result in recomputing this list
  return is.object(res) && res.items ? res.items : res
}

export const completionDetail = async (data: NeovimState, item: CompletionItem): Promise<CompletionItem> => {
  const req = toProtocol(data)
  return (await request('completionItem/resolve', { ...req, ...item })) || {}
}

export const signatureHelp = async (data: NeovimState) => {
  const req = toProtocol(data)
  return await request('textDocument/signatureHelp', req) as SignatureHelp
}

export const codeLens = async (data: NeovimState): Promise<CodeLens[]> => {
  const req = toProtocol(data)
  return (await request('textDocument/codeLens', req)) || []
}

export const codeAction = async (data: NeovimState, diagnostics: Diagnostic[]): Promise<Command[]> => {
  const req = toProtocol(data)

  // i noticed that in vscode if there are diagnostics, then the request 'range' matches on of the
  // diagnostic entries. otherwise i'm getting cannot read property 'description' of undefined error
  // from the TS lang serv. weird
  const range = diagnostics.length
    ? { start: diagnostics[0].range.start, end: diagnostics[0].range.end }
    : { start: req.position, end: req.position }

  const langRequest = {
    range,
    cwd: req.cwd,
    filetype: req.filetype,
    textDocument: req.textDocument,
    context: { diagnostics }
  }

  // TODO: what is causing 'cannot read description of undefined error in lsp server?'
  return (await request('textDocument/codeAction', langRequest)) || []
}

export const executeCommand = async (data: NeovimState, command: Command) => {
  const req = toProtocol(data)
  notify('workspace/executeCommand', { ...req, ...command })
}

export const applyEdit = async (edit: WorkspaceEdit) => nvim.applyPatches(workspaceEditToPatch(edit))
