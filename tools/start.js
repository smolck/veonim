'use strict'

const { $, go, run, fromRoot, createTask } = require('./runner')
const { copy, codemod, paths } = require('./build')
const fs = require('fs-extra')

const devConfig = fromRoot('xdg_config')

go(async () => {
  $`local dev XDG_CONFIG_HOME dir: ${devConfig}`
  await fs.ensureDir(devConfig)

  await Promise.all([
    copy.index(),
    copy.processExplorer(),
    copy.assets(),
    copy.runtime(),
    copy.hyperapp(),
  ])

  const tsc = { main: createTask(), workers: createTask() }

  run('tsc -p tsconfig.json --watch --preserveWatchOutput', {
    outputMatch: 'compilation complete',
    onOutputMatch: tsc.main.done,
  })

  run('tsc -p src/workers/tsconfig.json --watch --preserveWatchOutput', {
    outputMatch: 'compilation complete',
    onOutputMatch: () => codemod.workerExports().then(tsc.workers.done),
  })

  await Promise.all([ tsc.main.promise, tsc.workers.promise ])

  run('electron build/bootstrap/main.js', {
    env: {
      ...process.env,
      VEONIM_DEV: 42,
      XDG_CONFIG_HOME: devConfig,
    }
  })

  $`watching index.html for changes...`
  fs.watch(fromRoot(paths.index), copy.index)
  fs.watch(fromRoot(paths.processExplorer), copy.processExplorer)
})
