import { threadSafeObject } from '../support/utils'
import { call } from '../messaging/worker-client'
import languages from '../vscode/languages'
import { Diagnostic } from 'vscode'

export interface DiagnosticsEvent {
  path: string
  diagnostics: Diagnostic[]
}

languages.onDidChangeDiagnostics(({ uris }) => {
  const diagnostics = uris.map(uri => ({
    path: uri.path,
    diagnostics: threadSafeObject(languages.getDiagnostics(uri)),
  }))

  call.diagnostics(diagnostics)
})
