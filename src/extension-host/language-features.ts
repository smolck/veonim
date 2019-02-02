import providers from '../extension-host/providers'
import { on } from '../messaging/worker-client'
import { maybe } from '../support/types'
import * as vsc from 'vscode'

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
const api = {
  completion: (context: vsc.CompletionContext, tokenId?: string) => ({ cancel, promise: async () => {
    const completions = await providers.provideCompletionItems(context, tokenId!)
    const incomplete = completions.some(m => !!(m as vsc.CompletionList).isIncomplete)
    return {
      incomplete,
      // TODO: we should probably dedup completion items
      // from multiple providers. do that here or in the provider?
      items: completions.reduce((res, item) => {
        const next = (item as vsc.CompletionList).items
          ? (item as vsc.CompletionList).items
          : [item as vsc.CompletionItem]
        return [...res, ...next]
      }, [] as vsc.CompletionItem[])
    }
  }}),
  resolveCompletion: (item: vsc.CompletionItem, tokenId?: string) => ({ cancel, promise: async () => {
    // TODO: which one? first?
    const [ resolve ] = await providers.resolveCompletionItem(item, tokenId!)
    return resolve
  }}),
  codeActions: (context: vsc.CodeActionContext, tokenId?: string) => ({ cancel, promise: async () => {
    const actions = await providers.provideCodeActions(context, tokenId!)
    return actions
    // TODO: this is hard
    // return actions.map(m => {
    //   const cmd = m as vsc.Command
    //   const act = m as vsc.CodeAction
    //   return Object.assign(m, m.command)
    // })
  }}),
  codeLens: (tokenId?: string) => ({ cancel, promise: async () => {
    return providers.provideCodeLenses(tokenId!)
  }}),
  definition: (tokenId?: string) => ({ cancel, promise: async () => {
    const [ location ] = await providers.provideDefinition(tokenId!)
    if (!location) return
    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: ((location as vsc.Location).range || (location as vsc.LocationLink).targetRange),
    }
  }}),
  implementation: (tokenId?: string) => ({ cancel, promise: async () => {
    const [ location ] = await providers.provideImplementation(tokenId!)
    if (!location) return
    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: ((location as vsc.Location).range || (location as vsc.LocationLink).targetRange),
    }
  }}),
  typeDefinition: (tokenId?: string) => ({ cancel, promise: async () => {
    const [ location ] = await providers.provideTypeDefinition(tokenId!)
    if (!location) return
    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: ((location as vsc.Location).range || (location as vsc.LocationLink).targetRange),
    }
  }}),
  declaration: (tokenId?: string) => ({ cancel, promise: async () => {
    const [ location ] = await providers.provideDeclaration(tokenId!)
    if (!location) return
    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      range: ((location as vsc.Location).range || (location as vsc.LocationLink).targetRange),
    }
  }}),
  hover: (tokenId?: string) => ({ cancel, promise: async () => {
    const [ hover ] = await providers.provideHover(tokenId!)
    if (!hover) return
    return hover.contents.reduce((res, markedString) => {
      const text = typeof markedString === 'string' ? markedString : markedString.value
      return [...res, text]
    }, [] as string[])
  }}),
  documentHighlights: (tokenId?: string) => ({ cancel, promise: async () => {
    return providers.provideDocumentHighlights(tokenId!)
  }}),
  documentSymbols: (tokenId?: string) => ({ cancel, promise: async () => {
    const symbols = await providers.provideDocumentSymbols(tokenId!)
    return symbols.map(m => {
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
  }}),
  resolveDocumentSymbols: (tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  prepareRename: (tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  rename: (tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  documentFormattingEdits: (tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  documentRangeFormattingEdits: (tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  onTypeFormattingEdits: (tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  signatureHelp: (tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  documentLinks: (tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  resolveDocumentLink: (tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  colorPresentations: (tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  documentColors: (tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  foldingRanges: (tokenId?: string) => ({ cancel, promise: async () => {

  }}),
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
  return func(...args, tokenId).promise
})

on.language_trigger_characters(async (method: string) => {
  const func = Reflect.get(triggerCharacters, method)
  if (!func) return console.error('no trigger characters method for:', method)
  return func()
})
