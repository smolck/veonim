import { Unpacked, maybe, AlterReturnType, ReturnTypeOf } from '../support/types'
import { MapSetter, dedupOn, threadSafeObject } from '../support/utils'
import { makeCancelToken, cancelTokenById, Thenable } from '../vscode/tools'
import TextDocument from '../vscode/text-document'
import { Position, Range } from '../vscode/types'
import { on } from '../messaging/worker-client'
import workspace from '../vscode/workspace'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

// lol
type MassageProviderResult<S> = AlterReturnType<S, Promise<Unpacked<Exclude<Exclude<ReturnTypeOf<S>, vsc.ProviderResult<S>>, Thenable<any>>>[] | undefined>>

const $$GET_PROVIDERS = Symbol('GET_PROVIDERS')

const F = <T extends object>() => {
  const ms = new MapSetter<string, T>()
  const register = (filetypes: string[], items: T) => ms.addMultiple(filetypes, items)
  const call = (providerMethodName: string, args: any[]) => {
    const providerz = ms.get(nvim.state.filetype)
    if (!providerz) return
    const requests = [...providerz].map(provider => {
      const func = Reflect.get(provider, providerMethodName)
      if (typeof func === 'function') return func.apply(provider, args)
    })
    return Promise.all(requests).then(coalesce)
  }

  type Base = { [K in keyof T]: MassageProviderResult<T[K]> }
  interface Api {
    register(filetypes: string[], items: T): ReturnType<MapSetter<string, T>['addMultiple']>
  }

  return new Proxy(Object.create(null), {
    get: (_, key: string | symbol) => {
      if (key === $$GET_PROVIDERS) return ms
      if (key === 'register') return register
      return (...args: any[]) => call(key as string, args)
    }
  }) as Base & Api
}

export const providers = {
  completionTriggerCharacters: new MapSetter<string, string>(),
  signatureHelpTriggerCharacters: new MapSetter<string, string>(),
  onTypeFormattingTriggerCharacters: new MapSetter<string, string>(),
  completionItem: F<vsc.CompletionItemProvider>(),
  codeAction: F<vsc.CodeActionProvider>(),
  codeLens: F<vsc.CodeLensProvider>(),
  definition: F<vsc.DefinitionProvider>(),
  implementation: F<vsc.ImplementationProvider>(),
  typeDefinition: F<vsc.TypeDefinitionProvider>(),
  declaration: F<vsc.DeclarationProvider>(),
  hover: F<vsc.HoverProvider>(),
  documentHighlight: F<vsc.DocumentHighlightProvider>(),
  documentSymbol: F<vsc.DocumentSymbolProvider>(),
  workspaceSymbol: F<vsc.WorkspaceSymbolProvider>(),
  reference: F<vsc.ReferenceProvider>(),
  rename: F<vsc.RenameProvider>(),
  documentFormattingEdit: F<vsc.DocumentFormattingEditProvider>(),
  documentRangeFormattingEdit: F<vsc.DocumentRangeFormattingEditProvider>(),
  onTypeFormattingEdit: F<vsc.OnTypeFormattingEditProvider>(),
  signatureHelp: F<vsc.SignatureHelpProvider>(),
  documentLink: F<vsc.DocumentLinkProvider>(),
  color: F<vsc.DocumentColorProvider>(),
  foldingRange: F<vsc.FoldingRangeProvider>(),
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
const cache = {
  currentCompletionItems: [] as vsc.CompletionItem[],
}

const simplify = {
  completionItem: (item: vsc.CompletionItem, index = 0) => {
    const { label, kind, detail, documentation, sortText, filterText,
      preselect, insertText, range, commitCharacters, keepWhitespace, textEdit,
      additionalTextEdits, /*command*/ } = item
    // TODO: call CompletionItem.command after completion was inserted into the document
    // we should probably handle this from the extension-host because serializing the
    // Command object across threads is a no-no
    // TODO: determine what it means inserted? in the typescript-language-features
    // extension, a CompletionItem.command had something like "completionAccepted"
    // which indicates that it is not the insertion of text when we scroll thru the
    // completion menu, but rather on CompletionDone event (the final word)
    return { index, label, kind, detail, documentation, sortText, filterText,
      preselect, insertText, range, commitCharacters, keepWhitespace, textEdit,
      additionalTextEdits }
  }
}

export const completionRequest = {
  active: false,
  line: -1,
  character: -1,
}

const api = {
  cancelRequest: (tokenId: string) => cancelTokenById(tokenId),
  provideCompletionItems: (context: vsc.CompletionContext, tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    Object.assign(completionRequest, {
      active: true,
      line: nvim.state.line,
      character: nvim.state.column,
    })

    const results = await providers.completionItem.provideCompletionItems(document, position, token, context)
    Object.assign(completionRequest, {
      active: false,
      line: -1,
      character: -1,
    })
    if (!results) return

    cache.currentCompletionItems = results.reduce((res, item) => {
      const next = (item as vsc.CompletionList).items
        ? (item as vsc.CompletionList).items
        : [item as vsc.CompletionItem]
      return [...res, ...next]
    }, [] as vsc.CompletionItem[])

    // the CompletionItem returned from the extensions has a bunch of extra
    // stuff tacked onto it that is not part of the CompletionItem interface.
    // we don't want to transfer all the extra memes across threads as it makes
    // serialization take much too long, and some stuff is lost during the
    // serialization process.
    // so we do a couple things:
    // 1. extract only the relevant information (the properties defined in the
    // vscode.CompletionItem interface) to send back to the parent threads
    // 2. keep a temporary copy of the entire completion list in memory so
    // that when we need to resolve a completion item we can send the extension
    // the same object that we received. (things break if we do not send back
    // the same object to the extension)
    const completions = cache.currentCompletionItems.map((item, index) => simplify.completionItem(item, index))

    // we will not dedup completions as they will be run thru the fuzzy filter engine
    return completions
  })()}),
  resolveCompletionItem: (item: vsc.CompletionItem, tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const realItem = Reflect.get(cache.currentCompletionItems, (item as any).index)
    const results = await providers.completionItem.resolveCompletionItem!(realItem, token)
    return results && simplify.completionItem(results[0])
  })()}),
  getCompletionTriggerCharacters: () => ({ cancel, promise: (async () => {
    return [...providers.completionTriggerCharacters.get(nvim.state.filetype) || []]
  })()}),
  provideCodeActions: (context: vsc.CodeActionContext, tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const range = new Range(position, position)
    const results = await providers.codeAction.provideCodeActions(document, range, context, token)
    if (!results) return

    const actions = results.map(m => m.command
      ? m as vsc.CodeAction
      : { command: m as vsc.Command, title: m.title })

    return dedupOn(actions, (a, b) => a.command && b.command
      ? a.command.command === b.command.command
      : (a as vsc.CodeAction).title === (b as vsc.CodeAction).title)
  })()}),
  provideCodeLenses: (tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const lenses = await providers.codeLens.provideCodeLenses(document, token)
    if (!lenses) return
    return dedupOn(lenses, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  resolveCodeLens: (codeLens: vsc.CodeLens, tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const results = await providers.codeLens.resolveCodeLens!(codeLens, token)
    return results && results[0]
  })()}),
  provideDefinition: (tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const results = await providers.definition.provideDefinition(document, position, token)
    if (!results) return

    const [ location ] = results
    if (!location) return

    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: threadSafeObject((location as vsc.Location).range || (location as vsc.LocationLink).targetRange),
    }
  })()}),
  provideImplementation: (tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const results = await providers.implementation.provideImplementation(document, position, token)
    if (!results) return

    const [ location ] = results
    if (!location) return

    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: threadSafeObject((location as vsc.Location).range || (location as vsc.LocationLink).targetRange),
    }
  })()}),
  provideTypeDefinition: (tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const results = await providers.typeDefinition.provideTypeDefinition(document, position, token)
    if (!results) return

    const [ location ] = results
    if (!location) return

    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: threadSafeObject((location as vsc.Location).range || (location as vsc.LocationLink).targetRange),
    }
  })()}),
  provideDeclaration: (tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const results = await providers.declaration.provideDeclaration(document, position, token)
    if (!results) return

    const [ location ] = results
    if (!location) return

    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: threadSafeObject((location as vsc.Location).range || (location as vsc.LocationLink).targetRange),
    }
  })()}),
  provideHover: (tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const results = await providers.hover.provideHover(document, position, token)
    if (!results) return

    const [ hover ] = results
    if (!hover) return

    return hover.contents.reduce((res, markedString) => {
      const text = typeof markedString === 'string' ? markedString : markedString.value
      return [...res, text]
    }, [] as string[]).filter(m => m)
  })()}),
  provideDocumentHighlights: (tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const highlights = await providers.documentHighlight.provideDocumentHighlights(document, position, token)
    if (!highlights) return
    return dedupOn(highlights, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  provideDocumentSymbols: (tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const results = await providers.documentSymbol.provideDocumentSymbols(document, token)
    if (!results) return

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

    const res = dedupOn(symbols, (a, b) => a.name === b.name && rangesEqual(a.range, b.range))
    return threadSafeObject(res)
  })()}),
  provideWorkspaceSymbols: (query: string, tokenId?: string) => ({ cancel, promise: (async () => {
    const providerSet: MapSetter<string, vsc.WorkspaceSymbolProvider> = Reflect.get(providers.workspaceSymbol, $$GET_PROVIDERS)
    const providerz = providerSet.get('*')
    if (!providerz) return

    const { token } = makeCancelToken(tokenId!)

    const results = await Promise.all([...providerz].map(p => p.provideWorkspaceSymbols(query, token))).then(coalesce)

    const symbols = results.map(m => ({
      name: m.name,
      containerName: m.containerName,
      kind: m.kind,
      path: m.location.uri.path,
      range: m.location.range,
    }))

    const res = dedupOn(symbols, (a, b) => a.name === b.name && rangesEqual(a.range, b.range))
    return threadSafeObject(res)
  })()}),
  resolveWorkspaceSymbol: (symbol: vsc.SymbolInformation, tokenId?: string) => ({ cancel, promise: (async () => {
    const providerSet: MapSetter<string, vsc.WorkspaceSymbolProvider> = Reflect.get(providers.workspaceSymbol, $$GET_PROVIDERS)
    const providerz = providerSet.get('*')
    if (!providerz) return

    const { token } = makeCancelToken(tokenId!)
    const results = await Promise.all([...providerz].map(p => {
      return p.resolveWorkspaceSymbol && p.resolveWorkspaceSymbol(symbol, token)
    })).then(coalesce)

    return results[0]
  })()}),
  provideReferences: (tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const context: vsc.ReferenceContext = { includeDeclaration: true }
    const results = await providers.reference.provideReferences(document, position, context, token)
    if (!results) return

    const references = results.map(m => ({
      path: m.uri.path,
      range: threadSafeObject(m.range),
    }))
    return dedupOn(references, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  prepareRename: (tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const results = await providers.rename.prepareRename!(document, position, token)
    if (!results) return

    const [ result ] = results
    if (!result) return
    return ((result as any).range || result) as vsc.Range
  })()}),
  renameSymbol: (position: Position, newName: string, tokenId?: string) => ({ cancel, promise: (async () => {
    const providerSet: MapSetter<string, vsc.RenameProvider> = Reflect.get(providers.rename, $$GET_PROVIDERS)
    const providerz = providerSet.get(nvim.state.filetype)
    if (!providerz) return

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)

    const $$cancel = Symbol('cancel')
    const result = await Promise.race([
      Promise.all([...providerz].map(p => p.provideRenameEdits(document, position, newName, token))).then(coalesce),
      new Promise(done => setTimeout(() => done($$cancel), 10e3))
    ])

    if (result === $$cancel) {
      api.cancelRequest(tokenId!)
      return false
    }

    // TODO: do we need to dedup WorkspaceEdit objects? This might get tricky as they are not simple objects
    const editRequests = (result as vsc.WorkspaceEdit[]).map(workspace.applyEdit)
    return Promise.all(editRequests).then(() => true, () => false)
  })()}),
  provideDocumentFormattingEdits: (tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const options = await getFormattingOptions()
    const edits = await providers.documentFormattingEdit.provideDocumentFormattingEdits(document, options, token)
    if (!edits) return
    return dedupOn(edits, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  provideDocumentRangeFormattingEdits: (range: vsc.Range, tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const options = await getFormattingOptions()
    const edits = await providers.documentRangeFormattingEdit.provideDocumentRangeFormattingEdits(document, range, options, token)
    if (!edits) return
    return dedupOn(edits, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  provideOnTypeFormattingEdits: (character: string, tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const options = await getFormattingOptions()
    const edits = await providers.onTypeFormattingEdit.provideOnTypeFormattingEdits(document, position, character, options, token)
    if (!edits) return
    return dedupOn(edits, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  provideSignatureHelp: (context: vsc.SignatureHelpContext, tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const results = await providers.signatureHelp.provideSignatureHelp(document, position, token, context)
    return results && results[0]
  })()}),
  provideDocumentLinks: (tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const results = await providers.documentLink.provideDocumentLinks(document, token)
    if (!results) return

    const links = results.map(m => ({
      range: m.range,
      path: m.target ? m.target.path : undefined,
    }))

    return dedupOn(links, (a, b) => rangesEqual(a.range, b.range))
  })()}),
  resolveDocumentLink: (link: vsc.DocumentLink, tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const results = await providers.documentLink.resolveDocumentLink!(link, token)
    return results && results[0]
  })()}),
  provideColorPresentations: (color: vsc.Color, range: vsc.Range, tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const context = {
      range,
      document: TextDocument(nvim.current.buffer.id),
    }

    const colors = await providers.color.provideColorPresentations(color, context, token)
    if (!colors) return
    return dedupOn(colors, (a, b) => a.label === b.label)
  })()}),
  provideDocumentColors: (tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const colors = await providers.color.provideDocumentColors(document, token)
    if (!colors) return

    return dedupOn(colors, (a, b) => rangesEqual(a.range, b.range)
      && a.color.alpha === b.color.alpha
      && a.color.red === b.color.red
      && a.color.green === b.color.green
      && a.color.blue === b.color.blue)
  })()}),
  provideFoldingRanges: (tokenId?: string) => ({ cancel, promise: (async () => {
    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const options: vsc.FoldingContext = {}
    const ranges = await providers.foldingRange.provideFoldingRanges(document, options, token)
    if (!ranges) return
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
  return func(...args, tokenId).promise
})
