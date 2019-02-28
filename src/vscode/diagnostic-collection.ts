import { emitDidChangeDiagnostics } from '../vscode/languages'
import { is, MapList } from '../support/utils'
import { URI } from '../vscode/uri'
import * as vsc from 'vscode'

export default (name = ''): vsc.DiagnosticCollection => {
  const diagnostics = new MapList<string, vsc.Diagnostic>()

  type DiagEntries = [vsc.Uri, vsc.Diagnostic[] | undefined][]
  const api: vsc.DiagnosticCollection = {
    get name() { return name },
    set: (uriOrEntries: vsc.Uri | DiagEntries, givenDiagnostics?: vsc.Diagnostic[]) => {
      if (!uriOrEntries) return diagnostics.clear()

      const modifiedUris: vsc.Uri[] = []

      if (is.array(uriOrEntries)) (uriOrEntries as DiagEntries).forEach(([ uri, diags ]) => {
        if (!diags) return diagnostics.delete(uri.path)
        diagnostics.add(uri.path, diags)
        modifiedUris.push(uri)
      })

      else if (is.object(uriOrEntries)) {
        const path = (uriOrEntries as vsc.Uri).path
        if (!givenDiagnostics) return diagnostics.delete(path)
        diagnostics.replace(path, givenDiagnostics)
        modifiedUris.push(uriOrEntries as vsc.Uri)
      }

      emitDidChangeDiagnostics(modifiedUris)
    },
    delete: uri => {
      diagnostics.delete(uri.path)
      emitDidChangeDiagnostics([uri])
    },
    clear: () => {
      const paths = [...diagnostics.keys()]
      const uris = paths.map(path => URI.file(path))
      diagnostics.clear()
      emitDidChangeDiagnostics(uris)
    },
    forEach: fn => diagnostics.forEach((diags, path) => {
      fn(URI.parse(path), diags, api)
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
