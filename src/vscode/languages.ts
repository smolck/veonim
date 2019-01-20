import filetypeToVscLanguage, { vscLanguageToFiletypes } from '../langserv/vsc-languages'
import { SuperTextDocument } from '../vscode/text-document'
import { providers } from '../extension-host/providers'
import { selectorToFiletypes } from '../vscode/tools'
import { Watcher, is } from '../support/utils'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

// TODO: call these events
interface Events {
  didChangeDiagnostics: vsc.DiagnosticChangeEvent
}

const events = Watcher<Events>()

const languages: typeof vsc.languages = {
  getLanguages: async () => {
    const filetypes = await nvim.call.getcompletion('', 'filetype')
    return filetypes.map(ft => filetypeToVscLanguage(ft))
  },
  setTextDocumentLanguage: async (document, languageId) => {
    const filetype = vscLanguageToFiletypes(languageId)
    nvim.Buffer((document as SuperTextDocument)._nvimBufferId).setOption('filetype', filetype)
    return document
  },
  match: () => {
    console.warn('NYI: languages.match')
    return 0
  },
  onDidChangeDiagnostics: fn => registerEvent('didChangeDiagnostics', fn),
  getDiagnostics: () => {
    console.warn('NYI: languages.getDiagnostics')
    return []
  },
  createDiagnosticCollection: () => {
    console.warn('NYI: languages.createDiagnosticCollection')
  },
  setLanguageConfiguration: (language, configuration) => {
    console.warn('NYI: languages.setLanguageConfiguration', language, configuration)
    return { dispose: () => {} }
  },
  registerCompletionItemProvider: (selector, provider, ...triggerCharacters) => {
    const filetypes = selectorToFiletypes(selector)
    const d1 = providers.provideCompletionItems.addMultiple(filetypes, provider.provideCompletionItems)
    const d2 = providers.resolveCompletionItem.addMultiple(filetypes, provider.resolveCompletionItem)
    const d3 = providers.completionTriggerCharacters.addMultipleValues(filetypes, triggerCharacters)
    return { dispose: () => (d1(), d2(), d3()), }
  },
  registerCodeActionsProvider: (selector, provider, metadata) => {
    if (metadata) {
      console.warn('NYI: languages.registerCodeActionsProvider metadata not supported:', metadata)
    }

    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.provideCodeActions.addMultiple(filetypes, provider.provideCodeActions)
    return { dispose }
  },
  registerCodeLensProvider: (selector, provider) => {
    // TODO: handle provider.onDidChangeCodeLenses event?
    const filetypes = selectorToFiletypes(selector)
    const d1 = providers.provideCodeLenses.addMultiple(filetypes, provider.provideCodeLenses)
    const d2 = providers.resolveCodeLens.addMultiple(filetypes, provider.resolveCodeLens)
    return { dispose: () => (d1(), d2()) }
  },
  registerDefinitionProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.provideDefinition.addMultiple(filetypes, provider.provideDefinition)
    return { dispose }
  },
  registerImplementationProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.provideImplementation.addMultiple(filetypes, provider.provideImplementation)
    return { dispose }
  },
  registerTypeDefinitionProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.provideTypeDefinition.addMultiple(filetypes, provider.provideTypeDefinition)
    return { dispose }
  },
  registerDeclarationProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.provideDeclaration.addMultiple(filetypes, provider.provideDeclaration)
    return { dispose }
  },
  registerHoverProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.provideHover.addMultiple(filetypes, provider.provideHover)
    return { dispose }
  },
  registerDocumentHighlightProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.provideDocumentHighlights.addMultiple(filetypes, provider.provideDocumentHighlights)
    return { dispose }
  },
  registerDocumentSymbolProvider: (selector, provider, metadata) => {
    if (metadata) {
      console.warn('NYI: languages.registerDocumentSymbolProvider metadata not supported:', metadata)
    }

    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.provideDocumentSymbols.addMultiple(filetypes, provider.provideDocumentSymbols)
    return { dispose }
  },
  registerWorkspaceSymbolProvider: provider => {
    providers.provideWorkspaceSymbols.add(provider.provideWorkspaceSymbols)
    providers.resolveWorkspaceSymbol.add(provider.resolveWorkspaceSymbol)
    return { dispose: () => {
      providers.provideWorkspaceSymbols.delete(provider.provideWorkspaceSymbols)
      providers.resolveWorkspaceSymbol.delete(provider.resolveWorkspaceSymbol)
    }}
  },
  registerReferenceProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.provideReferences.addMultiple(filetypes, provider.provideReferences)
    return { dispose }
  },
  registerRenameProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const d1 = providers.provideRenameEdits.addMultiple(filetypes, provider.provideRenameEdits)
    const d2 = providers.prepareRename.addMultiple(filetypes, provider.prepareRename)
    return { dispose: () => (d1(), d2())}
  },
  registerDocumentFormattingEditProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.provideDocumentFormattingEdits.addMultiple(filetypes, provider.provideDocumentFormattingEdits)
    return { dispose }
  },
  registerDocumentRangeFormattingEditProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.provideDocumentRangeFormattingEdits.addMultiple(filetypes, provider.provideDocumentRangeFormattingEdits)
    return { dispose }
  },
  registerOnTypeFormattingEditProvider: (selector, provider, ...triggerCharacters) => {
    const filetypes = selectorToFiletypes(selector)
    const disposeProvider = providers.provideOnTypeFormattingEdits.addMultiple(filetypes, provider.provideOnTypeFormattingEdits)
    const disposeTriggers = providers.onTypeFormattingTriggerCharacters.addMultipleValues(filetypes, triggerCharacters)
    return { dispose: () => (disposeProvider(), disposeTriggers()) }
  },
  registerSignatureHelpProvider: (selector: vsc.DocumentSelector, provider: vsc.SignatureHelpProvider, firstTriggerCharOrMetadata: string | vsc.SignatureHelpProviderMetadata, ...moreTriggerChars: string[]) => {
    const filetypes = selectorToFiletypes(selector)
    const disposeProvider = providers.provideSignatureHelp.addMultiple(filetypes, provider.provideSignatureHelp)
    let triggerCharacters: string[] = []

    if (is.object(firstTriggerCharOrMetadata)) {
      const o = (firstTriggerCharOrMetadata as vsc.SignatureHelpProviderMetadata)
      triggerCharacters = [...o.triggerCharacters, ...o.retriggerCharacters]
    }
    else triggerCharacters = [(firstTriggerCharOrMetadata as string), ...moreTriggerChars]

    triggerCharacters.forEach(char => {
      providers.signatureHelpTriggerCharacters.addMultiple(filetypes, char)
    })

    const disposeTriggers = providers.signatureHelpTriggerCharacters.addMultipleValues(filetypes, triggerCharacters)

    return { dispose: () => (disposeProvider(), disposeTriggers()) }
  },
  registerDocumentLinkProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const d1 = providers.provideDocumentLinks.addMultiple(filetypes, provider.provideDocumentLinks)
    const d2 = providers.resolveDocumentLink.addMultiple(filetypes, provider.resolveDocumentLink)
    return { dispose: () => (d1(), d2())}
  },
  registerColorProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const d1 = providers.provideColorPresentations.addMultiple(filetypes, provider.provideColorPresentations)
    const d2 = providers.provideDocumentColors.addMultiple(filetypes, provider.provideDocumentColors)
    return { dispose: () => (d1(), d2())}
  },
  registerFoldingRangeProvider: (selector, provider) => {
    const filetypes = selectorToFiletypes(selector)
    const dispose = providers.provideFoldingRanges.addMultiple(filetypes, provider.provideFoldingRanges)
    return { dispose }
  },
}

const registerEvent = (name: keyof Events, fn: any) => ({ dispose: events.on(name, fn) })

export default languages
