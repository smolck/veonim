import filetypeToVscLanguage, { vscLanguageToFiletypes } from '../langserv/vsc-languages'
import { SuperTextDocument } from '../vscode/text-document'
import { providers } from '../extension-host/providers'
import { selectorToFiletypes } from '../vscode/tools'
import { Watcher, is } from '../support/utils'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

interface Events {
  didChangeDiagnostics: vsc.DiagnosticChangeEvent
}

const events = Watcher<Events>()

// const languages = {
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
    providers.provideCompletionItems.addMultiple(filetypes, provider)

    if (is.array(triggerCharacters)) triggerCharacters.forEach(char => {
      providers.completionTriggerCharacters.addMultiple(filetypes, char)
    })

    return {
      dispose: () => {
        providers.provideCompletionItems.removeMultipleFromSet(filetypes, provider)
        if (is.array(triggerCharacters)) triggerCharacters.forEach(char => {
          providers.completionTriggerCharacters.removeMultipleFromSet(filetypes, char)
        })
      }
    }
  },
  // registerCodeActionsProvider: (selector, provider, metadata) => {
  // },
}

const registerEvent = (name: keyof Events, fn: any) => ({ dispose: events.on(name, fn) })

export default languages
