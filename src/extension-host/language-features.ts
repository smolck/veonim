import providers from '../extension-host/providers'
import { on } from '../messaging/worker-client'
import * as vsc from 'vscode'

// this is used only to construct the typings interface
const cancel = () => {}

// tokenId is optional only for generating the interface. it will be for
// sure passed along by the client thread proxy api

// TODO: we should score multiple results and choose the best one
// do that here or in the providers?
const api = {
  completion: (context: vsc.CompletionContext, tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  resolveCompletion: (item: vsc.CompletionItem, tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  codeActions: (tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  codeLens: (tokenId?: string) => ({ cancel, promise: async () => {

  }}),
  definition: (tokenId?: string) => ({ cancel, promise: async () => {
    const [ locations ] = await providers.provideDefinition(tokenId!)
    // TODO: dont choose just the locations one - need to score from multiple providers... how does vscode do this?
    if (!locations) return
    const location = Array.isArray(locations) ? locations[0] : locations
    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      line: ((location as vsc.Location).range || (location as vsc.LocationLink).targetRange).start.line,
      column: ((location as vsc.Location).range || (location as vsc.LocationLink).targetRange).start.character,
    }
  }}),
  implementation: (tokenId?: string) => ({ cancel, promise: async () => {
    const [ locations ] = await providers.provideImplementation(tokenId!)
    if (!locations) return
    const location = Array.isArray(locations) ? locations[0] : locations
    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      line: ((location as vsc.Location).range || (location as vsc.LocationLink).targetRange).start.line,
      column: ((location as vsc.Location).range || (location as vsc.LocationLink).targetRange).start.character,
    }
  }}),
  typeDefinition: (tokenId?: string) => ({ cancel, promise: async () => {
    const [ locations ] = await providers.provideTypeDefinition(tokenId!)
    if (!locations) return
    const location = Array.isArray(locations) ? locations[0] : locations
    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      line: ((location as vsc.Location).range || (location as vsc.LocationLink).targetRange).start.line,
      column: ((location as vsc.Location).range || (location as vsc.LocationLink).targetRange).start.character,
    }
  }}),
  declaration: (tokenId?: string) => ({ cancel, promise: async () => {
    const [ locations ] = await providers.provideDeclaration(tokenId!)
    if (!locations) return
    const location = Array.isArray(locations) ? locations[0] : locations
    return {
      path: ((location as vsc.Location).uri || (location as vsc.LocationLink).targetUri).path,
      line: ((location as vsc.Location).range || (location as vsc.LocationLink).targetRange).start.line,
      column: ((location as vsc.Location).range || (location as vsc.LocationLink).targetRange).start.character,
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
    const results = await providers.provideDocumentHighlights(tokenId!)
    if (!results) return
    return results.filter(m => m).map(m => ({
      // line: m!.

    }))

  }}),
  documentSymbols: (tokenId?: string) => ({ cancel, promise: async () => {

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
