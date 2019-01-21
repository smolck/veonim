import { makeCancelToken, cancelTokenById } from '../vscode/tools'
import TextDocument from '../vscode/text-document'
import { Position, Range } from '../vscode/types'
import { on } from '../messaging/worker-client'
import { MapSetter } from '../support/utils'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

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

const api = {
  cancelRequest: (tokenId: string) => cancelTokenById(tokenId),
  provideCompletionItems: async (context: vsc.CompletionContext, tokenId: string) => {
    const funcs = providers.provideCompletionItems.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return Promise.all([...funcs].map(fn => fn(document, position, token, context)))
  },
  resolveCompletionItem: async (item: vsc.CompletionItem, tokenId: string) => {
    const funcs = providers.resolveCompletionItem.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId)

    return Promise.all([...funcs].map(fn => fn && fn(item, token)))
  },
  provideCodeActions: async (context: vsc.CodeActionContext, tokenId: string) => {
    const funcs = providers.provideCodeActions.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const range = new Range(position, position)

    return Promise.all([...funcs].map(fn => fn(document, range, context, token)))
  },
  provideCodeLenses: async (tokenId: string) => {
    const funcs = providers.provideCodeLenses.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId)
    const document = TextDocument(nvim.current.buffer.id)

    return Promise.all([...funcs].map(fn => fn(document, token)))
  },
  resolveCodeLens: async (codeLens: vsc.CodeLens, tokenId: string) => {
    const funcs = providers.resolveCodeLens.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId)

    return Promise.all([...funcs].map(fn => fn && fn(codeLens, token)))
  },
  provideDefinition: async (tokenId: string) => {
    const funcs = providers.provideDefinition.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return Promise.all([...funcs].map(fn => fn(document, position, token)))
  },
  provideImplementation: async (tokenId: string) => {
    const funcs = providers.provideImplementation.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return Promise.all([...funcs].map(fn => fn(document, position, token)))
  },
  provideTypeDefinition: async (tokenId: string) => {
    const funcs = providers.provideTypeDefinition.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return Promise.all([...funcs].map(fn => fn(document, position, token)))
  },
  provideDeclaration: async (tokenId: string) => {
    const funcs = providers.provideDeclaration.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return Promise.all([...funcs].map(fn => fn(document, position, token)))
  },
  provideHover: async (tokenId: string) => {
    const funcs = providers.provideHover.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return Promise.all([...funcs].map(fn => fn(document, position, token)))
  },
  provideDocumentHighlights: async (tokenId: string) => {
    const funcs = providers.provideDocumentHighlights.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return Promise.all([...funcs].map(fn => fn(document, position, token)))
  },
  provideDocumentSymbols: async (tokenId: string) => {
    const funcs = providers.provideHover.get(nvim.state.filetype)
    if (!funcs) return

    const { token } = makeCancelToken(tokenId)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return Promise.all([...funcs].map(fn => fn(document, position, token)))
  },
  provideWorkspaceSymbols: async (query: string, tokenId: string) => {
    const funcs = providers.provideWorkspaceSymbols
    const { token } = makeCancelToken(tokenId)

    return Promise.all([...funcs].map(fn => fn(query, token)))
  },
  resolveWorkspaceSymbol: async (symbol: vsc.SymbolInformation, tokenId: string) => {
    const funcs = providers.resolveWorkspaceSymbol
    const { token } = makeCancelToken(tokenId)

    return Promise.all([...funcs].map(fn => fn && fn(symbol, token)))
  },
}

export type Providers = typeof api

on.ai_request(async (method: string, tokenId: string, ...args: any[]) => {
  const func = Reflect.get(api, method)
  if (!func) return console.error('no language provider registered for:', method)
  return func(tokenId, ...args)
})
