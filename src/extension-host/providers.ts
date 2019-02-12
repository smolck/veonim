import { MapSetter, dedupOn, threadSafeObject } from '../support/utils'
import { makeCancelToken, cancelTokenById } from '../vscode/tools'
import { Position, Range, CompletionItem } from '../vscode/types'
import TextDocument from '../vscode/text-document'
import { Unpacked, maybe } from '../support/types'
import { on } from '../messaging/worker-client'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

interface WorkspaceEdit extends vsc.TextEdit {
  path: string
}

const F = <T>() => new MapSetter<string, T>()

export const providers = {
  provideCompletionItems: F<vsc.CompletionItemProvider['provideCompletionItems']>(),
  resolveCompletionItem: F<vsc.CompletionItemProvider['resolveCompletionItem']>(),
  completionTriggerCharacters: F<string>(),
  provideCodeActions: F<vsc.CodeActionProvider['provideCodeActions']>(),
  provideCodeLenses: F<vsc.CodeLensProvider['provideCodeLenses']>(),
  resolveCodeLens: F<vsc.CodeLensProvider['resolveCodeLens']>(),
  provideDefinition: F<vsc.DefinitionProvider['provideDefinition']>(),
  provideImplementation: F<vsc.ImplementationProvider['provideImplementation']>(),
  provideTypeDefinition: F<vsc.TypeDefinitionProvider['provideTypeDefinition']>(),
  provideDeclaration: F<vsc.DeclarationProvider['provideDeclaration']>(),
  provideHover: F<vsc.HoverProvider['provideHover']>(),
  provideDocumentHighlights: F<vsc.DocumentHighlightProvider['provideDocumentHighlights']>(),
  provideDocumentSymbols: F<vsc.DocumentSymbolProvider['provideDocumentSymbols']>(),
  provideWorkspaceSymbols: new Set<vsc.WorkspaceSymbolProvider['provideWorkspaceSymbols']>(),
  resolveWorkspaceSymbol: new Set<vsc.WorkspaceSymbolProvider['resolveWorkspaceSymbol']>(),
  provideReferences: F<vsc.ReferenceProvider['provideReferences']>(),
  prepareRename: F<vsc.RenameProvider['prepareRename']>(),
  provideRenameEdits: F<vsc.RenameProvider['provideRenameEdits']>(),
  provideDocumentFormattingEdits: F<vsc.DocumentFormattingEditProvider['provideDocumentFormattingEdits']>(),
  provideDocumentRangeFormattingEdits: F<vsc.DocumentRangeFormattingEditProvider['provideDocumentRangeFormattingEdits']>(),
  provideOnTypeFormattingEdits: F<vsc.OnTypeFormattingEditProvider['provideOnTypeFormattingEdits']>(),
  provideSignatureHelp: F<vsc.SignatureHelpProvider['provideSignatureHelp']>(),
  provideDocumentLinks: F<vsc.DocumentLinkProvider['provideDocumentLinks']>(),
  resolveDocumentLink: F<vsc.DocumentLinkProvider['resolveDocumentLink']>(),
  provideColorPresentations: F<vsc.DocumentColorProvider['provideColorPresentations']>(),
  provideDocumentColors: F<vsc.DocumentColorProvider['provideDocumentColors']>(),
  provideFoldingRanges: F<vsc.FoldingRangeProvider['provideFoldingRanges']>(),
  signatureHelpTriggerCharacters: F<string>(),
  onTypeFormattingTriggerCharacters: F<string>(),
}

const getFormattingOptions = async (): Promise<vsc.FormattingOptions> => {
  const [ tabstop, expandtab ] = await Promise.all([
    nvim.options.tabstop,
    nvim.options.expandtab,
  ])

  return {
    tabSize: tabstop,
    insertSpaces: !!expandtab,
  }
}

const coalesce = <T extends any[]>(results: T): NonNullable<Unpacked<Unpacked<T>>>[] => results.reduce((res, item) => {
  if (!item) return res
  const next = Array.isArray(item) ? item : [item]
  return [...res, ...next]
}, [])

const rangesEqual = (a: vsc.Range, b: vsc.Range): boolean => {
  const sameStart = a.start.line === b.start.line
    && a.start.character === b.start.character
  const sameEnd = a.end.line === b.end.line
    && a.end.character === b.end.character
  return sameStart && sameEnd
}

// this is used only to construct the typings interface
const cancel = () => {}

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
const prototypes = {
  completionItem: Object.getPrototypeOf(new CompletionItem('derp')),
}

const api = {
  cancelRequest: (tokenId: string) => cancelTokenById(tokenId),
  provideCompletionItems: (context: vsc.CompletionContext, tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideCompletionItems.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    const results = await Promise.all([...funcs].map(fn => fn(document, position, token, context))).then(coalesce)

    const allCompletions = results.reduce((res, item) => {
      const next = (item as vsc.CompletionList).items
        ? (item as vsc.CompletionList).items
        : [item as vsc.CompletionItem]
      return [...res, ...next]
    }, [] as vsc.CompletionItem[])

    const completions = dedupOn(allCompletions, (a, b) => a.label === b.label)
    const incomplete = results.some(m => !!(m as vsc.CompletionList).isIncomplete)

    // it seems we need to maintain the prototype of the CompletionItem. I tried regen
    // from CompletionItem and ProtocolCompletionItem (from vscode-languageclient)
    // but it did not work. this hack of saving the prototype of one of the items
    // seems to work... sorry
    if (completions.length) prototypes.completionItem = Object.getPrototypeOf(completions[0])

    return { incomplete, completions }
  })()}),
  resolveCompletionItem: (item: vsc.CompletionItem, tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.resolveCompletionItem.get(nvim.state.filetype)
    if (!funcs) return

    const realItem = Object.assign(Object.create(prototypes.completionItem), item)
    const { token } = makeCancelToken(tokenId!)

    const [ result ] = await Promise.all([...funcs].map(fn => fn && fn(realItem, token))).then(coalesce)
    return result
  })()}),
  getCompletionTriggerCharacters: () => ({ cancel, promise: (async () => {
    return [...providers.completionTriggerCharacters.get(nvim.state.filetype) || []]
  })()}),
  provideCodeActions: (context: vsc.CodeActionContext, tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideCodeActions.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const range = new Range(position, position)

    const results = await Promise.all([...funcs].map(fn => fn(document, range, context, token))).then(coalesce)
    const actions = results.map(m => m.command
      ? m as vsc.CodeAction
      : { command: m as vsc.Command, title: m.title })

    return dedupOn(actions, (a, b) => a.command && b.command
      ? a.command.command === b.command.command
      : (a as vsc.CodeAction).title === (b as vsc.CodeAction).title)
  })()}),
  provideCodeLenses: (tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideCodeLenses.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)

    const lenses = await Promise.all([...funcs].map(fn => fn(document, token))).then(coalesce)
    return dedupOn(lenses, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  resolveCodeLens: (codeLens: vsc.CodeLens, tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.resolveCodeLens.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)

    const [ result ] = await Promise.all([...funcs].map(fn => fn && fn(codeLens, token))).then(coalesce).then(coalesce)
    return result
  })()}),
  provideDefinition: (tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideDefinition.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    const [ location ] = await Promise.all([...funcs].map(fn => fn(document, position, token))).then(coalesce)
    if (!location) return

    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: (location as vsc.Location).range || (location as vsc.LocationLink).targetRange,
    }
  })()}),
  provideImplementation: (tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideImplementation.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    const [ location ] = await Promise.all([...funcs].map(fn => fn(document, position, token))).then(coalesce)
    if (!location) return

    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: (location as vsc.Location).range || (location as vsc.LocationLink).targetRange,
    }
  })()}),
  provideTypeDefinition: (tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideTypeDefinition.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    const [ location ] = await Promise.all([...funcs].map(fn => fn(document, position, token))).then(coalesce)
    if (!location) return

    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: (location as vsc.Location).range || (location as vsc.LocationLink).targetRange,
    }
  })()}),
  provideDeclaration: (tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideDeclaration.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    const [ location ] = await Promise.all([...funcs].map(fn => fn(document, position, token))).then(coalesce)
    if (!location) return

    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: (location as vsc.Location).range || (location as vsc.LocationLink).targetRange,
    }
  })()}),
  provideHover: (tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideHover.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    const [ hover ] = await Promise.all([...funcs].map(fn => fn(document, position, token))).then(coalesce)
    if (!hover) return

    return hover.contents.reduce((res, markedString) => {
      const text = typeof markedString === 'string' ? markedString : markedString.value
      return [...res, text]
    }, [] as string[]).filter(m => m)
  })()}),
  provideDocumentHighlights: (tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideDocumentHighlights.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    const highlights = await Promise.all([...funcs].map(fn => fn(document, position, token))).then(coalesce)
    return dedupOn(highlights, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  provideDocumentSymbols: (tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideDocumentSymbols.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)

    const results = await Promise.all([...funcs].map(fn => fn(document, token))).then(coalesce)
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

    return dedupOn(symbols, (a, b) => a.name === b.name && rangesEqual(a.range, b.range))
  })()}),
  provideWorkspaceSymbols: (query: string, tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideWorkspaceSymbols
    const { token } = makeCancelToken(tokenId!)

    const results = await Promise.all([...funcs].map(fn => fn(query, token))).then(coalesce)
    const symbols = results.map(m => ({
      name: m.name,
      containerName: m.containerName,
      kind: m.kind,
      path: m.location.uri.path,
      range: m.location.range,
    }))

    return dedupOn(symbols, (a, b) => a.name === b.name && rangesEqual(a.range, b.range))
  })()}),
  resolveWorkspaceSymbol: (symbol: vsc.SymbolInformation, tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.resolveWorkspaceSymbol
    const { token } = makeCancelToken(tokenId!)

    const [ result ] = await Promise.all([...funcs].map(fn => fn && fn(symbol, token))).then(coalesce)
    return result
  })()}),
  provideReferences: (tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideReferences.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const context: vsc.ReferenceContext = { includeDeclaration: true }

    const results = await Promise.all([...funcs].map(fn => fn(document, position, context, token))).then(coalesce)
    const references = results.map(m => ({
      path: m.uri.path,
      range: m.range,
    }))
    return dedupOn(references, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  prepareRename: (tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.prepareRename.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    const [ result ] = await Promise.all([...funcs].map(fn => fn && fn(document, position, token))).then(coalesce)
    if (!result) return
    return ((result as any).range || result) as vsc.Range
  })()}),
  provideRenameEdits: (newName: string, position: Position, tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideRenameEdits.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)

    const results = await Promise.all([...funcs].map(fn => fn && fn(document, position, newName, token))).then(coalesce)
    const workspaceEdits = results.reduce((list, workspaceEdit) => {
      return workspaceEdit.entries().reduce((res, [ uri, edits ]) => {
        const next = edits.map(edit => ({ ...threadSafeObject(edit), path: uri.path }))
        return [...res, ...next]
      }, list)
    }, [] as WorkspaceEdit[])

    return dedupOn(workspaceEdits, (a, b) => a.path === b.path && rangesEqual(a.range, b.range))
  })()}),
  provideDocumentFormattingEdits: (tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideDocumentFormattingEdits.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)

    const options = await getFormattingOptions()
    const edits = await Promise.all([...funcs].map(fn => fn && fn(document, options, token))).then(coalesce)
    return dedupOn(edits, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  provideDocumentRangeFormattingEdits: (range: vsc.Range, tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideDocumentRangeFormattingEdits.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const options = await getFormattingOptions()

    const edits = await Promise.all([...funcs].map(fn => fn && fn(document, range, options, token))).then(coalesce)
    return dedupOn(edits, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  provideOnTypeFormattingEdits: (character: string, tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideOnTypeFormattingEdits.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const options = await getFormattingOptions()

    const edits = await Promise.all([...funcs].map(fn => fn && fn(document, position, character, options, token))).then(coalesce)
    return dedupOn(edits, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  provideSignatureHelp: (context: vsc.SignatureHelpContext, tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideSignatureHelp.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    const [ result ] = await Promise.all([...funcs].map(fn => fn(document, position, token, context))).then(coalesce)
    return result
  })()}),
  provideDocumentLinks: (tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideDocumentLinks.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)

    const results = await Promise.all([...funcs].map(fn => fn(document, token))).then(coalesce)
    const links = results.map(m => ({
      range: m.range,
      path: m.target ? m.target.path : undefined,
    }))

    return dedupOn(links, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  resolveDocumentLink: (link: vsc.DocumentLink, tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.resolveDocumentLink.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)

    const [ result ] = await Promise.all([...funcs].map(fn => fn && fn(link, token))).then(coalesce)
    return result
  })()}),
  provideColorPresentations: (color: vsc.Color, range: vsc.Range, tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideColorPresentations.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const context = {
      range,
      document: TextDocument(nvim.current.buffer.id),
    }

    const colors = await Promise.all([...funcs].map(fn => fn(color, context, token))).then(coalesce)
    return dedupOn(colors, (a, b) => a.label === b.label)
  })()}),
  provideDocumentColors: (tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideDocumentColors.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)

    const colors = await Promise.all([...funcs].map(fn => fn(document, token))).then(coalesce)
    return dedupOn(colors, (a, b) => rangesEqual(a.range, b.range)
      && a.color.alpha === b.color.alpha
      && a.color.red === b.color.red
      && a.color.green === b.color.green
      && a.color.blue === b.color.blue)
  })()}),
  provideFoldingRanges: (tokenId?: string) => ({ cancel, promise: (async () => {
    const funcs = providers.provideFoldingRanges.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const options: vsc.FoldingContext = {}

    const ranges = await Promise.all([...funcs].map(fn => fn(document, options, token))).then(coalesce)
    return dedupOn(ranges, (a, b) => a.start === b.start && a.end === b.end)
  })()}),
  getSignatureHelpTriggerCharacters: () => ({ cancel, promise: (async () => {
    return [...providers.signatureHelpTriggerCharacters.get(nvim.state.filetype) || []]
  })()}),
  getOnTypeFormattingTriggerCharacters: () => ({ cancel, promise: (async () => {
    return [...providers.onTypeFormattingTriggerCharacters.get(nvim.state.filetype) || []]
  })()}),
}

export type Providers = typeof api

on.provider_cancel((tokenId: string) => api.cancelRequest(tokenId))

on.provider(async (method: string, args: any[], tokenId?: string) => {
  const func = Reflect.get(api, method)
  if (!func) return console.error('no language feature available for:', method)
  return func(...args, tokenId).promise.then(threadSafeObject)
})
