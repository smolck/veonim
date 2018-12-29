const vscode = require('vscode')
const path = require('path')

test('workspace.rootPath', eq => {
  eq(vscode.workspace.rootPath, testDataPath)
})

test('workspace.workspaceFolders', eq => {
  eq(vscode.workspace.workspaceFolders, [ testDataPath ])
})

test('workspace.name', eq => {
  const baseFolderName = path.basename(testDataPath)
  eq(vscode.workspace.name, baseFolderName)
})

test('workspace.textDocuments', async eq => {
  nvim.cmd(`e src/blarg.ts`)
  nvim.cmd(`e src/blarg3.ts`)

  await nvim.untilStateValue.file.is('src/blarg3.ts')
  const docs = vscode.workspace.textDocuments

  const [ doc1, doc2 ] = docs

  console.log('doc1', doc1.fileName)
  console.log('doc2', doc2.fileName)

  eq(docs.length, 2)
  eq(doc1.fileName, path.join(testDataPath, 'src/blarg.ts'))
  eq(doc2.fileName, path.join(testDataPath, 'src/blarg3.ts'))
})

test('workspace.onWillSaveTextDocument')
test('workspace.onDidChangeWorkspaceFolders')
test('workspace.onDidOpenTextDocument')
test('workspace.onDidCloseTextDocument')
test('workspace.onDidChangeTextDocument')
test('workspace.onDidSaveTextDocument')
test('workspace.onDidChangeConfiguration')

test('workspace.getWorkspaceFolder')
test('workspace.asRelativePath')
test('workspace.updateWorkspaceFolders')
test('workspace.createFileSystemWatcher')
test('workspace.findFiles')
test('workspace.saveAll')
test('workspace.applyEdit')
test('workspace.openTextDocument')
test('workspace.openTextDocument')
test('workspace.openTextDocument')
test('workspace.registerTextDocumentContentProvider')
test('workspace.getConfiguration')
test('workspace.registerTaskProvider')
test('workspace.registerFileSystemProvider')
