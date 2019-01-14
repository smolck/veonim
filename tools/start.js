'use strict'

const { $, go, run, fromRoot, createTask } = require('./runner')
const { copy, unfuckTypescript } = require('./build')
const fs = require('fs-extra')

const devConfig = fromRoot('xdg_config')

go(async () => {
  $`local dev XDG_CONFIG_HOME dir: ${devConfig}`
  await fs.ensureDir(devConfig)

  $`cleaning build folder`
  await fs.emptyDir(fromRoot('build'))

  await Promise.all([
    copy.index(),
    copy.processExplorer(),
    copy.assets(),
    copy.runtime(),
    copy.hyperapp(),
  ])

  const tsc = createTask()

  run('tsc -p src/tsconfig.json --watch --preserveWatchOutput', {
    outputMatch: 'compilation complete',
    onOutputMatch: async () => {
      await unfuckTypescript()
      copy.index()
      copy.processExplorer()
      tsc.done()
    },
  })

  await tsc.promise

  run('electron build/bootstrap/main.js', {
    shh: true,
    env: {
      ...process.env,
      VEONIM_DEV: 42,
      XDG_CONFIG_HOME: devConfig,
    }
  })
})
