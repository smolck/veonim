const vscode = require('vscode')

test('env.appName', eq => {
  eq(vscode.env.appName, 'Veonim')
})

test('env.appRoot', eq => {
  eq(vscode.env.appRoot, process.cwd())
})

test('env.language', eq => {
  eq(vscode.env.language, 'en-US')
})

test('env.machineId', eq => {
  eq(vscode.env.machineId, require('os').hostname())
})

test('env.sessionId', eq => {
  const includesName = vscode.env.sessionId.includes('Veonim-')
  eq(includesName, true, `expected ${vscode.env.sessionId} to start with Veonim-`)
})
