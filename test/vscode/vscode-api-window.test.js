const vscode = require('vscode')
const path = require('path')

// test('activeTextEditor', eq => { })
// test('visibleTextEditors')
// test('state')
// test('terminals')

// test('onDidChangeActiveTextEditor')
// test('onDidChangeVisibleTextEditors')
// test('onDidChangeTextEditorSelection')
// test('onDidChangeTextEditorVisibleRanges')
// test('onDidChangeTextEditorOptions')
// test('onDidChangeTextEditorViewColumn')
// test('onDidOpenTerminal')
// test('onDidCloseTerminal')
// test('onDidChangeWindowState')

// test('createInputBox')
// test('createOutputChannel')
// test('createQuickPick')
// test('createStatusBarItem')
// test('createTerminal')
// test('createTextEditorDecorationType')
// test('createTreeView')
// test('createWebviewPanel')
// test('registerTreeDataProvider')
// test('registerUriHandler')
// test('registerWebviewPanelSerializer')
test('setStatusBarMessage', () => {
  vscode.window.setStatusBarMessage('Installing your fancy shiny extensions')
})

test('setStatusBarMessage + timeout', () => {
  vscode.window.setStatusBarMessage('Catch me if you can', 1e3)
})

test('setStatusBarMessage + promise', () => {
  const promise = new Promise(done => setTimeout(done, 1e3))
  vscode.window.setStatusBarMessage('Installing your fancy shiny extensions', promise)
})

test('setStatusBarMessage + dispose', () => {
  const { dispose } = vscode.window.setStatusBarMessage('Installing your fancy shiny extensions')
  setTimeout(dispose, 1e3)
})
// test('showErrorMessage', ())
test('showInformationMessage', () => {
  vscode.window.showInformationMessage('Extension not installed. Install?', 'Yes')
})
// test('showInputBox')
// test('showOpenDialog')
// test('showQuickPick')
// test('showSaveDialog')
// test('showTextDocument')
// test('showWarningMessage')
// test('showWorkspaceFolderPick')
// test('withProgress')
// test('withScmProgress')
