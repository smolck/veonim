'use strict'

const { $, go, run, fromRoot } = require('./runner')
const fs = require('fs-extra')

const paths = {
  index: 'src/bootstrap/index.html',
  processExplorer: 'src/bootstrap/process-explorer.html',
}

const copy = {
  index: () => {
    $`copying index html`
    return fs.copy(fromRoot(paths.index), fromRoot('build/bootstrap/index.html'))
  },
  processExplorer: () => {
    $`copying process-explorer html`
    return fs.copy(fromRoot(paths.processExplorer), fromRoot('build/bootstrap/process-explorer.html'))
  },
  assets: () => {
    $`copying assets`
    return fs.copy(fromRoot('src/assets'), fromRoot('build/assets'))
  },
  runtime: () => {
    $`copying runtime files`
    return fs.copy(fromRoot('runtime'), fromRoot('build/runtime'))
  },
  hyperapp: () => {
    $`copying hyperapp`
    return fs.copy(fromRoot('src/ui/hyperapp.js'), fromRoot('build/ui/hyperapp.js'))
  },
}

const codemod = {
  workerExports: () => {
    $`adding exports objects to web workers to work in electron context`
    return run('jscodeshift -t tools/dummy-exports.js build/workers')
  },
  removeDebug: () => {
    $`removing debug code from release build`
    return run('jscodeshift -t tools/remove-debug.js build')
  },
}

require.main === module && go(async () => {
  $`cleaning build folder`
  await fs.emptyDir(fromRoot('build'))

  const tscMain = run('tsc -p tsconfig.json')
  const tscWorkers = run('tsc -p src/workers/tsconfig.json')

  await Promise.all([ tscMain, tscWorkers ])

  await codemod.workerExports()
  await codemod.removeDebug()

  await Promise.all([
    copy.index(),
    copy.processExplorer(),
    copy.assets(),
    copy.runtime(),
    copy.hyperapp(),
  ])
})

module.exports = { paths, copy, codemod }
