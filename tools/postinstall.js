#! /usr/bin/env node
const { $, go, run, fromRoot, fetchStream } = require('./runner')
const downloadGithubRelease = require('./gh-download-release')
const fs = require('fs-extra')
const pkgPath = fromRoot('package.json')
const pkg = require(pkgPath)
const os = process.platform
const deps = Reflect.get(pkg, 'binaryDependencies')
const extDeps = Reflect.get(pkg, 'bundled-extension-dependencies')

const binpath = 'binaries'

const binaryDependencies = async () => {
  if (!deps) return
  return Promise.all(deps.map(data => downloadGithubRelease(data, binpath)))
}

const extensionDependencies = async () => {
  if (!extDeps) return
  const dir = fromRoot('extension_dependencies')
  await fs.ensureDir(dir)

  for (const [ dependency, version ] of Object.entries(extDeps)) {
    await run(`npm i ${dependency}@${version} --no-save --no-package-lock --no-audit --loglevel=error --prefix ${dir}`)
  }
}

const vscodeTypings = () => new Promise(async (done, fail) => {
  const vscodeApiVersion = Reflect.get(pkg, 'vscode-api-version')
  $`fetching vscode api ${vscodeApiVersion}`
  const modulePath = 'node_modules/@types/vscode'
  const vscodeTypingsUrl = version => `https://raw.githubusercontent.com/Microsoft/vscode/${version}/src/vs/vscode.d.ts`

  await fs.ensureDir(fromRoot(modulePath))
  await fs.writeFile(fromRoot(modulePath, 'package.json'), `{
  "name": "@types/vscode",
  "main": "",
  "version": "${vscodeApiVersion}",
  "typings": "index.d.ts"
}\n`)

  const downloadStream = await fetchStream(vscodeTypingsUrl(vscodeApiVersion))
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

  $`installing extension dependencies`
  await extensionDependencies()
  $`installed extension dependencies`

  $`installing vscode extension api typings`
  await vscodeTypings().catch(err => console.log('failed to install vscode typings', err))
  $`installed vscode extension api typings`
})
