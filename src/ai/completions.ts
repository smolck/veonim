import { findIndexRight, hasUpperCase, EarlyPromise, exists, getDirFiles, resolvePath } from '../support/utils'
import { CompletionItemKind, CompletionItem } from 'vscode-languageserver-protocol'
import { completions, completionDetail } from '../langserv/adapter'
import transformCompletions from '../ai/completion-transforms'
import { getTriggerChars } from '../langserv/server-features'
import toVSCodeLanguage from '../langserv/vsc-languages'
import { workerData } from '../messaging/worker-client'
import * as ai from '../langserv/server-features'
import { filter } from 'fuzzaldrin-plus'
import Worker from '../messaging/worker'
import { join, dirname } from 'path'
import nvim from '../neovim/api'
import { ui } from '../core/ai'

interface Cache {
  semanticCompletions: Map<string, CompletionOption[]>,
  activeCompletion: string,
}

export enum CompletionKind {
  Path,
  Semantic,
  Keyword,
}

export interface CompletionOption {
  text: string,
  insertText: string,
  kind: CompletionItemKind,
  // TODO: raw is used to get more completion detail. perhaps should change
  // prop name to reflect that
  raw?: CompletionItem,
}

// TODO: do we really want to connect another nvim instance in the worker?
const harvester = Worker('harvester', { workerData })
const MAX_SEARCH_RESULTS = 50
const cache: Cache = {
  semanticCompletions: new Map(),
  activeCompletion: '',
}

const calcMenuPosition = async (startIndex: number, column: number) => {
  const cursorPosition = await nvim.getCursorPosition()
  return {
    row: cursorPosition.row,
    col: cursorPosition.col - (column - Math.max(0, startIndex)),
  }
}

const orderCompletions = (m: CompletionOption[], query: string) => m
  .slice()
  .sort(({ text }) => hasUpperCase(text) ? -1 : text.startsWith(query) ? -1 : 1)

const findQuery = (line: string, column: number) => {
  const start = findIndexRight(line, /[^\w\-]/, column - 1) || 0
  const startIndex = start ? start + 1 : 0
  const query = line.slice(startIndex, column) || ''
  const leftChar = line[start]
  return { startIndex, query, leftChar }
}

const findPathPerhaps = (lineContent: string, column: number) => {
  const invalid = { foundPath: '', startIndex: -1, query: '' }
  const match = lineContent.match(/(?:\/|\.\/|\.\.\/|~\/).*\//)
    || lineContent.match(/(\/|\.\/|\.\.\/|~\/)/)
    || [] as RegExpMatchArray

  if (!match[0] || !match.index) return invalid

  const querySearchResults = findQuery(lineContent, column)

  const foundPath = match[0]
  const startIndex = match.index + match[0].length
  const query = lineContent.slice(startIndex, column - 1)

  if (querySearchResults.startIndex < startIndex || querySearchResults.leftChar !== '/')
    return invalid

  return { foundPath, startIndex, query }
}

const reallyResolvePath = (path: string) => {
  const filepath = join(nvim.state.cwd, nvim.state.file)
  const fileDir = dirname(filepath)
  return resolvePath(path, fileDir)
}

const possiblePathCompletion = async (lineContent: string, column: number) => {
  const { foundPath, startIndex, query } = findPathPerhaps(lineContent, column)
  if (startIndex < 0) return { valid: false, fullpath: '', startIndex, query }
  const fullpath = reallyResolvePath(foundPath) || ''
  const valid = fullpath && await exists(fullpath)
  return { valid, startIndex, query, fullpath }
}

const getPathCompletions = async (path: string, query: string) => {
  const dirFiles = (await getDirFiles(path)).map(m => m.name)
  const results: string[] = query ? filter(dirFiles, query) : dirFiles.slice(0, 50)

  return results.map(path => ({
    text: path,
    insertText: path,
    kind: CompletionItemKind.File,
  }))
}

const getSemanticCompletions = (line: number, column: number) => EarlyPromise(async done => {
  if (cache.semanticCompletions.has(`${line}:${column}`)) 
    return done(cache.semanticCompletions.get(`${line}:${column}`)!)

  const supported = ai.supports.completion(nvim.state.cwd, nvim.state.filetype)
  if (!supported) return done([])

  const items = await completions(nvim.state)
  if (!items) return done([])

  const options = items.map(m => ({
    raw: m,
    insertText: m.insertText || m.label,
    text: m.label,
    kind: m.kind || CompletionItemKind.Text,
  }))

  cache.semanticCompletions.set(`${line}:${column}`, options)
  done(options)
})

// allow the filter engine to rank camel case completions higher. i.e. getUserInfo > gui for query 'gui'
const smartCaseQuery = (query: string): string => hasUpperCase(query[0])
  ? query
  : query[0] + query.slice(1).toUpperCase()

const showCompletionsRaw = (column: number, query: string, startIndex: number, lineContent: string) =>
  (completions: CompletionOption[], completionKind: CompletionKind) => {
    const transformedCompletions = transformCompletions(toVSCodeLanguage(nvim.state.filetype), {
      completionKind,
      lineContent,
      column,
      completionOptions: completions,
    })

    const options = orderCompletions(transformedCompletions, query)
    nvim.g.veonim_completions = options.map(m => m.insertText)
    nvim.g.veonim_complete_pos = startIndex

    calcMenuPosition(startIndex, column).then(({ row, col }) => {
      ui.completions.show({ row, col, options })
    })
  }

// TODO: merge global semanticCompletions with keywords?
export const discoverCompletions = async (lineContent: string, line: number, column: number) => {
  const { startIndex, query, leftChar } = findQuery(lineContent, column)
  const showCompletions = showCompletionsRaw(column, query, startIndex, lineContent)
  const triggerChars = getTriggerChars.completion(nvim.state.cwd, nvim.state.filetype)
  let semanticCompletions: CompletionOption[] = []

  cache.activeCompletion = `${line}:${startIndex}`

  const {
    fullpath,
    query: pathQuery,
    startIndex: pathStartIndex,
    valid: looksLikeWeNeedToCompleteAPath,
  } = await possiblePathCompletion(lineContent, column)

  if (looksLikeWeNeedToCompleteAPath) {
    const options = await getPathCompletions(fullpath, pathQuery)
    if (!options.length) return
    showCompletionsRaw(column, pathQuery, pathStartIndex, lineContent)(options, CompletionKind.Path)
    return
  }

  if (triggerChars.has(leftChar) || query.length) {
    const pendingSemanticCompletions = getSemanticCompletions(line, startIndex + 1)

    // TODO: send a $/cancelRequest on insertLeave if not interested anymore
    // maybe there is also a way to cancel if we moved to another completion location in the doc
    pendingSemanticCompletions.eventually(completions => {
      // this returned late; we started another completion and now this one is irrelevant
      if (cache.activeCompletion !== `${line}:${startIndex}`) return
      semanticCompletions = completions
      if (!query.length) showCompletions(completions, CompletionKind.Semantic)

      // how annoying is delayed semantic completions overriding pmenu? enable this if so:
      //else showCompletions([...cache.completionItems.slice(0, 1), ...completions])
    })

    semanticCompletions = await pendingSemanticCompletions.maybeAfter({ time: 50, or: [] })
  }

  if (!query.length && semanticCompletions.length) return showCompletions(semanticCompletions, CompletionKind.Semantic)

  if (query.length || semanticCompletions.length) {
    const queryCased = smartCaseQuery(query)
    const pendingKeywords = harvester
      .request
      .query(nvim.state.absoluteFilepath, queryCased, MAX_SEARCH_RESULTS)
      .then((res: string[]) => res.map(text => ({ text, insertText: text, kind: CompletionItemKind.Text })))

    // TODO: does it make sense to combine keywords with semantic completions? - right now it's either or...
    // i mean could try to do some sort of combination with ranking/priority. idk if the filtering will interfere with it
    // TODO: do we want more than MAX_SEARCH_RESULTS? i.e. i want to explore all of Array.prototype.* completions
    // and i want to scroll thru the list. should i support that use case? or just use the query to filter?
    const resSemantic = filter(semanticCompletions, queryCased, { maxResults: MAX_SEARCH_RESULTS, key: 'text' })
    const completionOptions = resSemantic.length ? resSemantic : await pendingKeywords

    if (!completionOptions.length) {
      nvim.g.veonim_completions = []
      ui.completions.hide()
      return
    }

    showCompletions(completionOptions, resSemantic.length ? CompletionKind.Semantic : CompletionKind.Keyword)
  } else {
    ui.completions.hide()
    nvim.g.veonim_completions = []
  }
}

export const getCompletionDetail = (item: CompletionItem): Promise<CompletionItem> => {
  const supported = ai.supports.completionResolve(nvim.state.cwd, nvim.state.filetype)
  return supported ? completionDetail(nvim.state, item) : Promise.resolve({} as CompletionItem)
}

nvim.on.insertLeave(async () => {
  cache.activeCompletion = ''
  cache.semanticCompletions.clear()
  ui.completions.hide()
})

nvim.on.completion(() => {
  nvim.g.veonim_completing = 0
  nvim.g.veonim_completions = []
})
