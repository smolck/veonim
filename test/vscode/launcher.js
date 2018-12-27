'use strict'

const { delay, pathExists, CreateTask, getPipeName } = require('../util')
const { Application } = require('spectron')
const { createConnection } = require('net')
const fs = require('fs-extra')
const path = require('path')

const connectToTestExtension = pipename => new Promise(done => {
  const client = createConnection(pipename, () => {
    console.log('connected to test extension')
    done(client)
  })
})

const makeTestExtensionApi = socket => {
  let id = 0
  const pendingRequests = new Map()
  const send = data => socket.write(JSON.stringify(data) + '\r\n')

  const api = func => ({
    call: (...args) => {
      const task = CreateTask()
      pendingRequests.set(id++, task.done)
      send({ id, func, args })
      return task.promise
    }
  })

  const process = thing => {
    const { id, result } = JSON.parse(thing)
    if (pendingRequests.has(id)) pendingRequests.get(id)(result)
  }

  socket.on('data', m => {
    const parts = (m+'').split(/\r\n/)
    parts.forEach(process)
  })

  return api
}

module.exports = async () => {
  const testExtensionPath = getPipeName('veonim-test-ext')
  const projectPath = path.join(__dirname, '../data')
  const extensionsPath = path.join(__dirname, '../../xdg_config/veonim/extensions')
  const testExtensionPath = path.join(__dirname, '../test-extension')

  await fs.copy(testExtensionPath, extensionsPath)

  const app = new Application({
    path: './node_modules/.bin/electron',
    args: [ path.join(__dirname, '../../build/bootstrap/main.js') ],
    env: {
      VEONIM_TEST_EXTENSION_PATH: testExtensionPath,
    }
  })

  await app.start()
  await app.client.waitUntilWindowLoaded()
  await delay(500)
  const testExtensionSocket = await connectToTestExtension(testExtensionPath)

  app.input = async m => {
    await delay(100)
    await app.client.keys(m)
  }

  app.input.enter = () => app.input('Enter')
  app.input.esc = () => app.input('Escape')

  app.input.meta = async m => {
    await app.input('\uE03D')
    await app.input(m)
    await app.input('\uE03D')
  }

  app.Veonim = async cmd => {
    await app.input(`:Veonim ${cmd}`)
    await app.input.enter()
  }

  await app.input(`:cd ${projectPath}`)
  await app.input.enter()

  return app
}
