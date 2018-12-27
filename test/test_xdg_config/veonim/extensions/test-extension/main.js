'use strict'
const vscode = require('vscode')
const { createServer } = require('net')
const { Script } = require('vm')

const activate = async () => {
  console.log('activating test-extension')

  const doTheNeedful = thing => {
    const { func, args, id } = JSON.parse(thing)
    const runner = new Script(func).runInThisContext()
    const result = await runner(vscode, ...args)
    socket.write(JSON.stringify({ id, result }) + '\r\n')
  }

  const server = createServer(socket => {
    socket.on('data', async m => {
      const parts = (m+'').split(/\r\n/)
      parts.forEach(doTheNeedful)
    })
  })

  server.listen(process.env.VEONIM_TEST_EXTENSION_PATH, () => {
    console.log('test extension listening', server.address())
  })
}

module.exports = { activate }
