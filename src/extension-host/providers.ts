import { makeCancelToken, cancelTokenById } from '../vscode/tools'
import TextDocument from '../vscode/text-document'
import { Position, Range } from '../vscode/types'
import { on } from '../messaging/worker-client'
import { MapSetter } from '../support/utils'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

const Flask = () => new MapSetter<string, any>()

export const providers = {
  provideCompletionItems: Flask(),
  resolveCompletionItem: Flask(),
  completionTriggerCharacters: new MapSetter<string, string>(),
  provideCodeActions: Flask(),
  provideCodeLenses: Flask(),
  resolveCodeLens: Flask(),
  provideDefinition: Flask(),
  provideImplementation: Flask(),
  provideTypeDefinition: Flask(),
  provideDeclaration: Flask(),
  provideHover: Flask(),
}

const api = {
  cancelRequest: (tokenId: string) => cancelTokenById(tokenId),
  provideCompletionItems: async (context: vsc.CompletionContext, tokenId: string) => {
    const filetypeProviders = providers.provideCompletionItems.get(nvim.state.filetype)
    if (!filetypeProviders) return

    const cancelToken = makeCancelToken(tokenId)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    type FN = vsc.CompletionItemProvider['provideCompletionItems']
    const requests = [...filetypeProviders].map((fn: FN) => {
      return fn(document, position, cancelToken.token, context)
    })

    return Promise.all(requests)
  },
  resolveCompletionItem: async (item: vsc.CompletionItem, tokenId: string) => {
    const filetypeProviders = providers.resolveCompletionItem.get(nvim.state.filetype)
    if (!filetypeProviders) return

    const cancelToken = makeCancelToken(tokenId)
    type FN = vsc.CompletionItemProvider['resolveCompletionItem']
    const requests = [...filetypeProviders].map((fn: FN) => {
      return fn(item, cancelToken.token)
    })

    return Promise.all(requests)
  },
  provideCodeActions: async (context: vsc.CodeActionContext, tokenId: string) => {
    const filetypeProviders = providers.provideCodeActions.get(nvim.state.filetype)
    if (!filetypeProviders) return

    const cancelToken = makeCancelToken(tokenId)
    const document = TextDocument(nvim.current.buffer.id)
    const position = new Position(nvim.state.line, nvim.state.column)
    const range = new Range(position, position)

    type FN = vsc.CodeActionProvider['provideCodeActions']
    const requests = [...filetypeProviders].map((fn: FN) => {
      return fn(document, range, context, cancelToken.token)
    })

    return Promise.all(requests)
  },
  provideCodeLenses: async (tokenId: string) => {

    type FN = vsc.CodeLensProvider['provideCodeLenses']

  },
  resolveCodeLens: async (codeLens: vsc.CodeLens, tokenId: string) => {

    type FN = vsc.CodeLensProvider['resolveCodeLens']

  },
  provideDefinition: async () => {
    type FN = vsc.DefinitionProvider['provideDefinition']
  },
  provideImplementation: async () => {
    type FN = vsc.ImplementationProvider['provideImplementation']
  },
  provideTypeDefinition: async () => {
    type FN = vsc.TypeDefinitionProvider['provideTypeDefinition']
  },
  provideDeclaration: async () => {
    type FN = vsc.DeclarationProvider['provideDeclaration']
  },
  provideHover: async () => {
    type FN = vsc.HoverProvider['provideHover']
  },
}

export type Providers = typeof api

on.ai_request(async (method: string, tokenId: string, ...args: any[]) => {
  const func = Reflect.get(api, method)
  if (!func) return console.error('no language provider registered for:', method)
  return func(tokenId, ...args)
})
