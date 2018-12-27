const { src, same } = require('../util')

const languages = src('vscode/languages').default

describe('vscode api - languages', () => {
  describe('event', () => {
    it('onDidChangeDiagnostics')
  })

  describe('func', () => {
    it('getLanguages')
    it('match')
    it('getDiagnostics')
    it('getDiagnostics')
    it('createDiagnosticCollection')
    it('registerCompletionItemProvider')
    it('registerCodeActionsProvider')
    it('registerCodeLensProvider')
    it('registerDefinitionProvider')
    it('registerImplementationProvider')
    it('registerTypeDefinitionProvider')
    it('registerHoverProvider')
    it('registerDocumentHighlightProvider')
    it('registerDocumentSymbolProvider')
    it('registerWorkspaceSymbolProvider')
    it('registerReferenceProvider')
    it('registerRenameProvider')
    it('registerDocumentFormattingEditProvider')
    it('registerDocumentRangeFormattingEditProvider')
  })
})
