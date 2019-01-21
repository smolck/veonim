import * as vsc from 'vscode'

export default (name: string): vsc.DiagnosticCollection => {
  const diagnostics = new Map<string, vsc.Diagnostic[]>()

  const api: vsc.DiagnosticCollection = {
    get name() { return name },
    set: (uri, diags) => {
        
      diagnostics.set(uri.)

    }
  }

  return api
}
