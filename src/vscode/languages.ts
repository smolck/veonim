import filetypeToVscLanguage, {
  vscLanguageToFiletypes,
} from '../vscode/vsc-languages'
import DiagnosticCollection from '../vscode/diagnostic-collection'
import { languageSelectorFrom } from '../vscode/type-converters'
import { Watcher, is, uuid, MapSetter } from '../support/utils'
import { regExpLeadsToEndlessLoop } from '../vscode/strings'
import { SuperTextDocument } from '../vscode/text-document'
import { providers } from '../extension-host/providers'
import { selectorToFiletypes } from '../vscode/tools'
import { score } from '../vscode/language-selector'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

interface Events {
  didChangeDiagnostics: vsc.DiagnosticChangeEvent
}

const events = Watcher<Events>()
export const wordDefinitions = new Map<string, RegExp | undefined>()
export const languageConfigurations = new Map<
  string,
  vsc.LanguageConfiguration
>()
export const emitDidChangeDiagnostics = (uris: vsc.Uri[]) =>
  events.emit('didChangeDiagnostics', { uris })
const diagnosticCollectionRepository = new Map<
  string,
  vsc.DiagnosticCollection
>()

type AM_I_STUPID = {
  (resource: vsc.Uri): vsc.Diagnostic[]
  (): [vsc.Uri, vsc.Diagnostic[]][]
}

const getDiagnostics_TYPESCRIPT_Y_U_DO_DIS = (resource?: vsc.Uri) => {
  const collections = [...diagnosticCollectionRepository.values()]

  if (resource)
    return collections.reduce((res, collection) => {
      const diagnostics = collection.get(resource as vsc.Uri)
      return diagnostics ? [...res, ...diagnostics] : res
    }, [] as vsc.Diagnostic[])

  const diagnosticsMapSet = collections.reduce((res, collection) => {
    collection.forEach((uri, diagnostics) => res.addMany(uri, diagnostics))
    return res
  }, new MapSetter<vsc.Uri, vsc.Diagnostic>())

  return [...diagnosticsMapSet.entries()].reduce((res, [uri, diagset]) => {
    const diagnostics = [...diagset]
    // typescript sucks lolwtf
    const next = [uri, diagnostics] as [vsc.Uri, vsc.Diagnostic[]]
    return [...res, next]
  }, [] as [vsc.Uri, vsc.Diagnostic[]][])
}

const PROGRAMMING_SUCKS_YAY = getDiagnostics_TYPESCRIPT_Y_U_DO_DIS as AM_I_STUPID

const eventreg = (name: keyof Events) => (fn: any, thisArg?: any) => ({
  dispose: events.on(name, fn.bind(thisArg)),
})

const languages: typeof vsc.languages = {
  // TODO: this is a proposed API. our extension discombobulator process should
  // target stable tags that match the vscode api instead of master@HEAD
  // @ts-ignore
  registerSelectionRangeProvider: () => {
    console.warn('NYI: registerSelectionRangeProvider')
  },
  getDiagnostics: PROGRAMMING_SUCKS_YAY,
  getLanguages: async () => {
    const filetypes = await nvim.call.getcompletion('', 'filetype')
    return filetypes.map((ft) => filetypeToVscLanguage(ft))
  },
  setTextDocumentLanguage: async (document, languageId) => {
    const filetype = vscLanguageToFiletypes(languageId)
    nvim
      .Buffer((document as SuperTextDocument)._nvimBufferId)
      .setOption('filetype', filetype)
    return document
  },
  match: (selector, document) => {
    // vscode type checking is not as strict as ours. the language selector does return undefined
    // which is not allowed according to the return signature. however it seems to be okay because
    // score() handles undefined (even though the signature does not permit undefined).
    // damn good job! damn good bloody good damn good job!
    const languageSelector = languageSelectorFrom(selector)!
    return score(languageSelector, document.uri, document.languageId, true)
  },
  onDidChangeDiagnostics: eventreg('didChangeDiagnostics'),
  createDiagnosticCollection: (name) => {
    const id = name || uuid()
    const key = diagnosticCollectionRepository.has(id) ? uuid() : id
    const collection = DiagnosticCollection(key)
    diagnosticCollectionRepository.set(key, collection)
    return collection
  },
  setLanguageConfiguration: (languageId, configuration) => {
    const { wordPattern } = configuration

    // check for a valid word pattern
    if (wordPattern && regExpLeadsToEndlessLoop(wordPattern)) {
      throw new Error(
        `Invalid language configuration: wordPattern '${wordPattern}' is not allowed to match the empty string.`
      )
    }

    wordDefinitions.set(languageId, wordPattern)
    languageConfigurations.set(languageId, configuration)
    return { dispose: () => languageConfigurations.delete(languageId) }
  },
  registerCompletionItemProvider: (
    selector,
    provider,
    ...triggerCharacters
  ) => {
    const filetypes = selectorToFiletypes(selector)
    const d1 = providers.completionItem.register(filetypes, provider)
    const d2 = providers.completionTriggerCharacters.addMultipleValues(
      filetypes,
      triggerCharacters
    )
    return { dispose: () => (d1(), d2()) }
  },
  registerCodeActionsProvider: (selector, provider, metadata) => {
    if (metadata) {
      // TODO: metadata includes CodeActionKind like quickfix, refactor, source.organizeImports. wat do wit dis?
      console.warn(
        'NYI: languages.registerCodeActionsProvider metadata not supported:',
        metadata
      )
    }

    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.codeAction.register(filetypes, provider)
    return { dispose }
  },
  registerCodeLensProvider: (selector, provider) => {
    // TODO: handle provider.onDidChangeCodeLenses event?
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.codeLens.register(filetypes, provider)
    return { dispose }
  },
  registerDefinitionProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.definition.register(filetypes, provider)
    return { dispose }
  },
  registerImplementationProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.implementation.register(filetypes, provider)
    return { dispose }
  },
  registerTypeDefinitionProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.typeDefinition.register(filetypes, provider)
    return { dispose }
  },
  registerDeclarationProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.declaration.register(filetypes, provider)
    return { dispose }
  },
  registerHoverProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.hover.register(filetypes, provider)
    return { dispose }
  },
  registerDocumentHighlightProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.documentHighlight.register(filetypes, provider)
    return { dispose }
  },
  registerDocumentSymbolProvider: (selector, provider, metadata) => {
    if (metadata) {
      console.warn(
        'NYI: languages.registerDocumentSymbolProvider metadata not supported:',
        metadata
      )
    }

    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.documentSymbol.register(filetypes, provider)
    return { dispose }
  },
  registerWorkspaceSymbolProvider: (provider) => {
    const dispose = providers.workspaceSymbol.register(['*'], provider)
    return { dispose }
  },
  registerReferenceProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.reference.register(filetypes, provider)
    return { dispose }
  },
  registerRenameProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.rename.register(filetypes, provider)
    return { dispose }
  },
  registerDocumentFormattingEditProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.documentFormattingEdit.register(
      filetypes,
      provider
    )
    return { dispose }
  },
  registerDocumentRangeFormattingEditProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.documentRangeFormattingEdit.register(
      filetypes,
      provider
    )
    return { dispose }
  },
  registerOnTypeFormattingEditProvider: (
    selector,
    provider,
    ...triggerCharacters: string[]
  ) => {
    const filetypes = selectorToFiletypes(selector)
    const disposeProvider = providers.onTypeFormattingEdit.register(
      filetypes,
      provider
    )
    const disposeTriggers = providers.onTypeFormattingTriggerCharacters.addMultipleValues(
      filetypes,
      triggerCharacters
    )
    return { dispose: () => (disposeProvider(), disposeTriggers()) }
  },
  registerSignatureHelpProvider: (
    selector: vsc.DocumentSelector,
    provider: vsc.SignatureHelpProvider,
    firstTriggerCharOrMetadata: string | vsc.SignatureHelpProviderMetadata,
    ...moreTriggerChars: string[]
  ) => {
    const filetypes = selectorToFiletypes(selector)
    const disposeProvider = providers.signatureHelp.register(
      filetypes,
      provider
    )
    let triggerCharacters: string[] = []

    if (is.object(firstTriggerCharOrMetadata)) {
      const o = firstTriggerCharOrMetadata as vsc.SignatureHelpProviderMetadata
      triggerCharacters = [...o.triggerCharacters, ...o.retriggerCharacters]
    } else
      triggerCharacters = [
        firstTriggerCharOrMetadata as string,
        ...moreTriggerChars,
      ]

    triggerCharacters.forEach((char) => {
      providers.signatureHelpTriggerCharacters.addMultiple(filetypes, char)
    })

    const disposeTriggers = providers.signatureHelpTriggerCharacters.addMultipleValues(
      filetypes,
      triggerCharacters
    )

    return { dispose: () => (disposeProvider(), disposeTriggers()) }
  },
  registerDocumentLinkProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.documentLink.register(filetypes, provider)
    return { dispose }
  },
  registerColorProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.color.register(filetypes, provider)
    return { dispose }
  },
  registerFoldingRangeProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.foldingRange.register(filetypes, provider)
    return { dispose }
  },
}

export default languages
