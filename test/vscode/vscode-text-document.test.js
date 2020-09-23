const vscode = require('vscode')
const path = require('path')

test('getText', (eq) => {
  const start = new vscode.Position(1, 1)
  const end = new vscode.Position(1, 4)
  const range = new vscode.Range(start, end)
  const doc = vscode.window.activeTextEditor.document
  const text = doc.getText(range)
  console.log('text', text)
  eq(text, 'foooo')
})
