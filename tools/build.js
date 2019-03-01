'use strict'

const { $, go, run, fromRoot, getDirFiles } = require('./runner')
const path = require('path')
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
  extensionDependencies: () => {
    $`copying extension dependencies`
    return fs.copy(fromRoot('extension_dependencies/node_modules'), fromRoot('build/extdeps'))
  },
  binaries: () => {
    $`copying binaries`
    return fs.copy(fromRoot('binaries'), fromRoot('build/binaries'))
  },
  hyperapp: () => {
    $`copying hyperapp`
    return fs.copy(fromRoot('src/ui/hyperapp.js'), fromRoot('build/ui/hyperapp.js'))
  },
}

const wtfTypescriptSucks = 'Object.defineProperty(exports, "__esModule", { value: true });'

const unfuckTypescript = async () => {
  $`unfucking typescript exports shit javascript/electron is cancer programming sucks`
  const dirs = await getDirFiles(fromRoot('build'))
  const filesReq = dirs.reduce((files, dir) => {
    return [...files, getDirFiles(dir.path)]
  }, [])

  const dirfiles = await Promise.all(filesReq)
  const files = dirfiles.reduce((files, fileGroup) => {
    return [...files, ...fileGroup.map(f => f.path)]
  }, [])

  const jsFiles = files.filter(f => path.extname(f) === '.js')

  const requests = jsFiles.map(async f => {
    const filedata = await fs.readFile(f, 'utf8')
    const unfucked = filedata.replace(wtfTypescriptSucks, '')
    return fs.writeFile(f, unfucked)
  })

  return Promise.all(requests)
}

const copyAll = () => Promise.all([
  copy.index(),
  copy.processExplorer(),
  copy.assets(),
  copy.runtime(),
  copy.extensionDependencies(),
  copy.binaries(),
  copy.hyperapp(),
])

require.main === module && go(async () => {
  $`cleaning build folder`
  await fs.emptyDir(fromRoot('build'))
  await run('ttsc -p src/tsconfig.json')
  await unfuckTypescript()
  await copyAll()
})

module.exports = { paths, copy, copyAll, unfuckTypescript }
