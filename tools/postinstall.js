#! /usr/bin/env node
const { $, go, run, fromRoot } = require('./runner')
const downloadGithubRelease = require('./gh-download-release')
const fs = require('fs-extra')
const pkgPath = fromRoot('package.json')
const pkg = require(pkgPath)
const deps = Reflect.get(pkg, 'binaryDependencies')
const extDeps = Reflect.get(pkg, 'bundled-extension-dependencies')

const binpath = 'binaries'

const binaryDependencies = async () => {
  if (!deps) return
  return Promise.all(deps.map((data) => downloadGithubRelease(data, binpath)))
}

const extensionDependencies = async () => {
  if (!extDeps) return
  const dir = fromRoot('extension_dependencies')
  await fs.ensureDir(dir)

  for (const [dependency, version] of Object.entries(extDeps)) {
    await run(
      `npm i ${dependency}@${version} --no-save --no-package-lock --no-audit --loglevel=error --prefix ${dir}`
    )
  }
}

require.main === module &&
  go(async () => {
    $`installing extension dependencies`
    await extensionDependencies()
    $`installed extension dependencies`

    $`installing binary dependencies`
    await binaryDependencies()
    $`installed binary dependencies`
  })
