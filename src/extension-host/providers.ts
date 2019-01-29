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

// this is used only to construct the typings interface
const cancel = () => {}
const promise = Promise.resolve()

const api = {
  cancelRequest: (tokenId?: string) => cancelTokenById(tokenId!),
  provideCompletionItems: (context: vsc.CompletionContext, tokenId?: string) => {
    const funcs = providers.provideCompletionItems.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, position, token, context))) }
  },
  resolveCompletionItem: (item: vsc.CompletionItem, tokenId?: string) => {
    const funcs = providers.resolveCompletionItem.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn && fn(item, token))) }
  },
  getCompletionTriggerCharacters: () => {
    return { cancel, promise: [...providers.completionTriggerCharacters.get(nvim.state.filetype) || []] }
  },
  provideCodeActions: (context: vsc.CodeActionContext, tokenId?: string) => {
    const funcs = providers.provideCodeActions.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const range = new Range(position, position)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, range, context, token))) }
  },
  provideCodeLenses: (tokenId?: string) => {
    const funcs = providers.provideCodeLenses.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, token))) }
  },
  resolveCodeLens: (codeLens: vsc.CodeLens, tokenId?: string) => {
    const funcs = providers.resolveCodeLens.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn && fn(codeLens, token))) }
  },
  provideDefinition: (tokenId?: string) => {
    const funcs = providers.provideDefinition.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, position, token))) }
  },
  provideImplementation: (tokenId?: string) => {
    const funcs = providers.provideImplementation.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, position, token))) }
  },
  provideTypeDefinition: (tokenId?: string) => {
    const funcs = providers.provideTypeDefinition.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, position, token))) }
  },
  provideDeclaration: (tokenId?: string) => {
    const funcs = providers.provideDeclaration.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, position, token))) }
  },
  provideHover: (tokenId?: string) => {
    const funcs = providers.provideHover.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, position, token))) }
  },
  provideDocumentHighlights: (tokenId?: string) => {
    const funcs = providers.provideDocumentHighlights.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, position, token))) }
  },
  provideDocumentSymbols: (tokenId?: string) => {
    const funcs = providers.provideDocumentSymbols.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, token))) }
  },
  provideWorkspaceSymbols: (query: string, tokenId?: string) => {
    const funcs = providers.provideWorkspaceSymbols
    const { token } = makeCancelToken(tokenId!)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(query, token))) }
  },
  resolveWorkspaceSymbol: (symbol: vsc.SymbolInformation, tokenId?: string) => {
    const funcs = providers.resolveWorkspaceSymbol
    const { token } = makeCancelToken(tokenId!)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn && fn(symbol, token))) }
  },
  provideReferences: (tokenId?: string) => {
    const funcs = providers.provideReferences.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const context: vsc.ReferenceContext = { includeDeclaration: true }

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, position, context, token))) }
  },
  prepareRename: (tokenId?: string) => {
    const funcs = providers.prepareRename.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn && fn(document, position, token))) }
  },
  provideRenameEdits: (newName: string, tokenId?: string) => {
    const funcs = providers.provideRenameEdits.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn && fn(document, position, newName, token))) }
  },
  provideDocumentFormattingEdits: (tokenId?: string) => {
    const funcs = providers.provideDocumentFormattingEdits.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)

    return {
      cancel,
      promise: (async () => {
        const options = await getFormattingOptions()
        return Promise.all([...funcs].map(fn => fn && fn(document, options, token)))
      })()
    }
  },
  provideDocumentRangeFormattingEdits: (range: Range, tokenId?: string) => {
    const funcs = providers.provideDocumentRangeFormattingEdits.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)

    return {
      cancel,
      promise: (async () => {
        const options = await getFormattingOptions()
        return Promise.all([...funcs].map(fn => fn && fn(document, range, options, token)))
      })()
    }
  },
  provideOnTypeFormattingEdits: (character: string, tokenId?: string) => {
    const funcs = providers.provideOnTypeFormattingEdits.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return {
      cancel,
      promise: (async () => {
        const options = await getFormattingOptions()
        return Promise.all([...funcs].map(fn => fn && fn(document, position, character, options, token)))
      })()
    }
  },
  provideSignatureHelp: (context: vsc.SignatureHelpContext, tokenId?: string) => {
    const funcs = providers.provideSignatureHelp.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, position, token, context))) }
  },
  provideDocumentLinks: (tokenId?: string) => {
    const funcs = providers.provideDocumentLinks.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, token))) }
  },
  resolveDocumentLink: (link: vsc.DocumentLink, tokenId?: string) => {
    const funcs = providers.resolveDocumentLink.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn && fn(link, token))) }
  },
  provideColorPresentations: (color: vsc.Color, range: Range, tokenId?: string) => {
    const funcs = providers.provideColorPresentations.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const context = {
      range,
      document: TextDocument(nvim.current.buffer.id),
    }

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(color, context, token))) }
  },
  provideDocumentColors: (tokenId?: string) => {
    const funcs = providers.provideDocumentColors.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, token))) }
  },
  provideFoldingRanges: (tokenId?: string) => {
    const funcs = providers.provideFoldingRanges.get(nvim.state.filetype)
    if (!funcs) return { cancel, promise }

    const { token } = makeCancelToken(tokenId!)
    const document = TextDocument(nvim.current.buffer.id)
    const options: vsc.FoldingContext = {}

    return { cancel, promise: Promise.all([...funcs].map(fn => fn(document, options, token))) }
  },
  getSignatureHelpTriggerCharacters: () => {
    return { cancel, promise: [...providers.signatureHelpTriggerCharacters.get(nvim.state.filetype) || []] }
  },
  getOnTypeFormattingTriggerCharacters: () => {
    return { cancel, promise: [...providers.onTypeFormattingTriggerCharacters.get(nvim.state.filetype) || []] }
  },
}

export type Providers = typeof api

on.vscode_provider_request(async (method: string, args: any[], tokenId: string) => {
  const func = Reflect.get(api, method)
  if (!func) return console.error('no language provider registered for:', method)
  return func(...args, tokenId).promise
})
