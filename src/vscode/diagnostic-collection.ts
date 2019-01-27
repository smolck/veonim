import { is, MapList } from '../support/utils'
import { URI } from '../vscode/uri'
import * as vsc from 'vscode'

// TODO: fire onDiagnosticsChange events when the diagnostic collection is modified
export default (name = ''): vsc.DiagnosticCollection => {
  const diagnostics = new MapList<string, vsc.Diagnostic>()

  type DiagEntries = [vsc.Uri, vsc.Diagnostic[] | undefined][]
  const api: vsc.DiagnosticCollection = {
    get name() { return name },
    set: (uriOrEntries: vsc.Uri | DiagEntries, givenDiagnostics?: vsc.Diagnostic[]) => {
      if (is.array(uriOrEntries)) (uriOrEntries as DiagEntries).forEach(([ uri, diags ]) => {
        if (diags == null) diagnostics.delete(uri.path)
        else diagnostics.add(uri.path, diags)
      })
      else if (is.object(uriOrEntries)) {
        const path = (uriOrEntries as vsc.Uri).path
        if (!givenDiagnostics) diagnostics.delete(path)
        else diagnostics.replace(path, givenDiagnostics)
      }
      else diagnostics.clear()
    },
    delete: uri => diagnostics.delete(uri.path),
    clear: () => diagnostics.clear(),
    forEach: fn => diagnostics.forEach((diags, path) => {
      fn(URI.file(path), diags, api)
    }),
    get: uri => {
      const diags = diagnostics.get(uri.path)
      if (!diags) return
      return [...diags]
    },
    has: uri => diagnostics.has(uri.path),
    dispose: () => diagnostics.clear(),
  }

  return api
}
