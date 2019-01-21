import { is } from '../support/utils'
import { URI } from '../vscode/uri'
import * as vsc from 'vscode'

export default (name = ''): vsc.DiagnosticCollection => {
  const diagnostics = new Map<string, vsc.Diagnostic[]>()

  type DiagEntry = [vsc.Uri, vsc.Diagnostic[] | undefined][]
  const api: vsc.DiagnosticCollection = {
    get name() { return name },
    set: (uriOrEntries: vsc.Uri | DiagEntry, givenDiagnostics: vsc.Diagnostic[]) => {
      if (is.array(uriOrEntries)) (uriOrEntries as DiagEntry).forEach(([ uri, diags ]) => diags && diagnostics.set(uri.path, diags))
      else if (is.object(uriOrEntries)) diagnostics.set((uriOrEntries as vsc.Uri).path, givenDiagnostics)
      else diagnostics.clear()
    },
    delete: uri => diagnostics.delete(uri.path),
    clear: () => diagnostics.clear(),
    forEach: fn => diagnostics.forEach((diags, path) => {
      fn(URI.file(path), diags, api)
    }),
    get: uri => diagnostics.get(uri.path),
    has: uri => diagnostics.has(uri.path),
    dispose: () => diagnostics.clear(),
  }

  return api
}
