#! /usr/bin/env node
const { $, go, run, fromRoot, fetch } = require('./runner')
const fs = require('fs-extra')
const pkgPath = fromRoot('package.json')
const pkg = require(pkgPath)
const os = process.platform
const deps = Reflect.get(pkg, `bindeps-${os}`)

const binaryDependencies = async () => {
  if (!deps) return

  for (const [ dependency, version ] of Object.entries(deps)) {
    await run(`npm i ${dependency}@${version} --no-save --no-package-lock --no-audit --loglevel=error`)
  }

  const pkgData = JSON.stringify(pkg, null, 2)
  await fs.writeFile(pkgPath, pkgData)
}

const vscodeTypings = () => new Promise(async (done, fail) => {
  const vscodeApiVersion = Reflect.get(pkg, 'vscode-api-version')
  const modulePath = 'node_modules/@types/vscode'
const vscodeTypingsUrl = version => `https://raw.githubusercontent.com/Microsoft/vscode/${version}/src/vs/vscode.d.ts`

  await fs.ensureDir(fromRoot(modulePath))
  await fs.writeFile(fromRoot(modulePath, 'package.json'), `{
  "name": "@types/vscode",
  "main": "",
  "version": "${vscodeApiVersion}",
  "typings": "index.d.ts"
}\n`)

  const downloadStream = await fetch(vscodeTypingsUrl(vscodeApiVersion))
  const fileStream = fs.createWriteStream(fromRoot(modulePath, 'index.d.ts'))

  downloadStream
    .pipe(fileStream)
    .on('close', done)
    .on('error', fail)
})

require.main === module && go(async () => {
  $`installing binary dependencies`
  await binaryDependencies()
  $`installed binary dependencies`

  $`installing vscode extension api typings`
  await vscodeTypings().catch(err => console.log('failed to install vscode typings', err))
  $`installed vscode extension api typings`
})

module.exports = { deps }
