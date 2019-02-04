import { dedupOn, dedupOnCompare, threadSafeObject } from '../support/utils'
import providers from '../extension-host/providers'
import { on } from '../messaging/worker-client'
import { maybe } from '../support/types'
import * as vsc from 'vscode'

// this is used only to construct the typings interface
const cancel = () => {}

const rangesEqual = (a: vsc.Range, b: vsc.Range): boolean => {
  const sameStart = a.start.line === b.start.line
    && a.start.character === b.start.character
  const sameEnd = a.end.line === b.end.line
    && a.end.character === b.end.character
  return sameStart && sameEnd
}

// tokenId is optional only for generating the interface. it will be for
// sure passed along by the client thread proxy api

// TODO: currently we extract only the first item, but we should be more intelligent
// about how we extract multiple provider results.
// or if we are supposed to get a list then we may
// have duplicates from multiple providers. need to dedup
// but before that need to score priority of providers
// i think the scoring is based on how closely the
// DocumentSelector matches the current filetype?

// ACKCHYUALLY...
// for multiple results:
// - list -> merge together (completions, symbols, codeActions, etc.)
//   - TODO: does vscode rank certain provider's completions higher than others?
// - single -> ask user to choose (definition, implementation, etc.)
// - what about non-user ones, like resolving things or hover, signhelp?
const api = {
  completion: (context: vsc.CompletionContext, tokenId?: string) => ({ cancel, promise: (async () => {
    const results = await providers.provideCompletionItems(context, tokenId!)

    const allCompletions = results.reduce((res, item) => {
      const next = (item as vsc.CompletionList).items
        ? (item as vsc.CompletionList).items
        : [item as vsc.CompletionItem]
      return [...res, ...next]
    }, [] as vsc.CompletionItem[])

    const completions = dedupOn(allCompletions, m => m.label)
    const incomplete = results.some(m => !!(m as vsc.CompletionList).isIncomplete)

    return { incomplete, completions }
  })()}),
  resolveCompletion: (item: vsc.CompletionItem, tokenId?: string) => ({ cancel, promise: (async () => {
    const [ result ] = await providers.resolveCompletionItem(item, tokenId!)
    return result
  })()}),
  codeActions: (context: vsc.CodeActionContext, tokenId?: string) => ({ cancel, promise: (async () => {
    const results = await providers.provideCodeActions(context, tokenId!)
    const actions = results.map(m => {
      const cmd = m as vsc.Command
      const act = m as vsc.CodeAction
      const res = { command: act.command || cmd, }
      return act.command ? Object.assign(res, { ...act }) : res
    })

    return dedupOn(actions, m => m.command.title)
  })()}),
  codeLens: (tokenId?: string) => ({ cancel, promise: (async () => {
    const lenses = await providers.provideCodeLenses(tokenId!)
    return dedupOnCompare(lenses, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  definition: (tokenId?: string) => ({ cancel, promise: (async () => {
    const [ location ] = await providers.provideDefinition(tokenId!)
    if (!location) return
    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: (location as vsc.Location).range || (location as vsc.LocationLink).targetRange,
    }
  })()}),
  implementation: (tokenId?: string) => ({ cancel, promise: (async () => {
    const [ location ] = await providers.provideImplementation(tokenId!)
    if (!location) return
    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: (location as vsc.Location).range || (location as vsc.LocationLink).targetRange,
    }
  })()}),
  typeDefinition: (tokenId?: string) => ({ cancel, promise: (async () => {
    const [ location ] = await providers.provideTypeDefinition(tokenId!)
    if (!location) return
    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: (location as vsc.Location).range || (location as vsc.LocationLink).targetRange,
    }
  })()}),
  declaration: (tokenId?: string) => ({ cancel, promise: (async () => {
    const [ location ] = await providers.provideDeclaration(tokenId!)
    if (!location) return
    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: (location as vsc.Location).range || (location as vsc.LocationLink).targetRange,
    }
  })()}),
  hover: (tokenId?: string) => ({ cancel, promise: (async () => {
    const [ hover ] = await providers.provideHover(tokenId!)
    if (!hover) return []
    return hover.contents.reduce((res, markedString) => {
      const text = typeof markedString === 'string' ? markedString : markedString.value
      return [...res, text]
    }, [] as string[])
  })()}),
  documentHighlights: (tokenId?: string) => ({ cancel, promise: (async () => {
    const highlights = await providers.provideDocumentHighlights(tokenId!)
    return dedupOnCompare(highlights, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  documentSymbols: (tokenId?: string) => ({ cancel, promise: (async () => {
    const results = await providers.provideDocumentSymbols(tokenId!)
    const symbols = results.map(m => {
      const info = m as vsc.SymbolInformation
      const docsym = m as vsc.DocumentSymbol
      return {
        name: m.name,
        kind: m.kind,
        range: info.location ? info.location.range : docsym.range,
        containerName: maybe(info.containerName),
        detail: maybe(docsym.detail),
        children: maybe(docsym.children),
        selectionRange: maybe(docsym.selectionRange),
      }
    })

    return dedupOnCompare(symbols, (a, b) => a.name === b.name && rangesEqual(a.range, b.range))
  })()}),
  workspaceSymbols: (query: string, tokenId?: string) => ({ cancel, promise: (async () => {
    const results = await providers.provideWorkspaceSymbols(query, tokenId!)
    const symbols = results.map(m => ({
      name: m.name,
      containerName: m.containerName,
      kind: m.kind,
      path: m.location.uri.path,
      range: m.location.range,
    }))

    return dedupOnCompare(symbols, (a, b) => a.name === b.name && rangesEqual(a.range, b.range))
  })()}),
  resolveWorkspaceSymbols: (symbol: vsc.SymbolInformation, tokenId?: string) => ({ cancel, promise: (async () => {
    const [ result ] = await providers.resolveWorkspaceSymbol(symbol, tokenId!)
    return result
  })()}),
  prepareRename: (tokenId?: string) => ({ cancel, promise: (async () => {
    const res = (await providers.prepareRename(tokenId!))[0]
    return ((res as any).range || res) as vsc.Range
  })()}),
  rename: (newName: string, tokenId?: string) => ({ cancel, promise: (async () => {
    // TODO: dedup edits
    const edits = await providers.provideRenameEdits(newName, tokenId!)
    // TODO: map edits
    return edits
  })()}),
  documentFormattingEdits: (tokenId?: string) => ({ cancel, promise: (async () => {
    // TODO: dedup
    const edits = await providers.provideDocumentFormattingEdits(tokenId!)
    // TODO: map edits
    return edits
  })()}),
  documentRangeFormattingEdits: (range: vsc.Range, tokenId?: string) => ({ cancel, promise: (async () => {
    // TODO: dedup
    const edits = await providers.provideDocumentRangeFormattingEdits(range, tokenId!)
    return edits
  })()}),
  onTypeFormattingEdits: (character: string, tokenId?: string) => ({ cancel, promise: (async () => {
    // TODO: dedup
    const edits = await providers.provideOnTypeFormattingEdits(character, tokenId!)
    return edits
  })()}),
  signatureHelp: (context: vsc.SignatureHelpContext, tokenId?: string) => ({ cancel, promise: (async () => {
    const [ result ] = await providers.provideSignatureHelp(context, tokenId!)
    return result
  })()}),
  documentLinks: (tokenId?: string) => ({ cancel, promise: (async () => {
    const results = await providers.provideDocumentLinks(tokenId!)
    const links = results.map(m => ({
      range: m.range,
      path: m.target ? m.target.path : undefined,
    }))

    return dedupOnCompare(links, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  resolveDocumentLink: (link: vsc.DocumentLink, tokenId?: string) => ({ cancel, promise: (async () => {
    return (await providers.resolveDocumentLink(link, tokenId!))[0]
  })()}),
  colorPresentations: (color: vsc.Color, range: vsc.Range, tokenId?: string) => ({ cancel, promise: (async () => {
    const colors = await providers.provideColorPresentations(color, range, tokenId!)
    // TODO: dedup & map
    return colors
  })()}),
  documentColors: (tokenId?: string) => ({ cancel, promise: (async () => {
    const colors = await providers.provideDocumentColors(tokenId!)

    return dedupOnCompare(colors, (a, b) => rangesEqual(a.range, b.range)
      && a.color.alpha === b.color.alpha
      && a.color.red === b.color.red
      && a.color.green === b.color.green
      && a.color.blue === b.color.blue)
  })()}),
  foldingRanges: (tokenId?: string) => ({ cancel, promise: (async () => {
    const ranges = await providers.provideFoldingRanges(tokenId!)
    return dedupOnCompare(ranges, (a, b) => a.start === b.start && a.end === b.end)
  })()}),
}

const triggerCharacters = {
  completion: () => providers.getCompletionTriggerCharacters(),
  signatureHelp: () => providers.getSignatureHelpTriggerCharacters(),
  onTypeFormatting: () => providers.getOnTypeFormattingTriggerCharacters(),
}

export type LanguageFeatures = typeof api
export type LanguageTriggerCharacters = typeof triggerCharacters

on.language_feature_cancel((tokenId: string) => providers.cancelRequest(tokenId))

on.language_feature(async (method: string, args: any[], tokenId: string) => {
  const func = Reflect.get(api, method)
  if (!func) return console.error('no language feature available for:', method)
  return func(...args, tokenId).promise.then(threadSafeObject)
})

on.language_trigger_characters(async (method: string) => {
  const func = Reflect.get(triggerCharacters, method)
  if (!func) return console.error('no trigger characters method for:', method)
  return func()
})
