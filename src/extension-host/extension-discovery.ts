import { ensureDir, NewlineSplitter, getDirs, readFile, fromJSON, remove as removePath, exists } from '../support/utils'
import downloadExtensionsIfNotExist, { doneDownloadingForNow } from '../extension-host/download-extensions'
import { ExtensionPackageConfig } from '../extension-host/extension'
import { EXT_PATH, LOG_PATH } from '../support/config-paths'
import { loadExtensions } from '../vscode/extensions'
import { Ripgrep } from '../support/binaries'
import copy from '../support/fs-copy'
import { sep, join } from 'path'
import nvim from '../neovim/api'

const findPackageJson = (path: string): Promise<string> => new Promise((done, fail) => {
  const results = [] as string[]
  const rg = Ripgrep(['--files', '--glob', '!node_modules', '--glob', '**/package.json'], { cwd: path })
  rg.stderr.pipe(new NewlineSplitter()).on('data', fail)
  rg.stdout.pipe(new NewlineSplitter()).on('data', (pkgpath: string) => results.push(pkgpath))

  rg.on('close', () => {
    if (!results.length) return done()

    const paths = results.map(m => ({
      path: m,
      levels: m.split(sep).length,
    }))

    const orderedPaths = paths.sort((a, b) => a.levels - b.levels)
    const fullpath = join(path, orderedPaths[0].path)
    done(fullpath)
  })
})

const getExtensionConfig = async (packagePath: string): Promise<ExtensionPackageConfig> => {
  if (!packagePath) throw new Error(`packagePath does not exist. oopsie doopsie`)
  const fileExists = await exists(packagePath)
  if (!fileExists) throw new Error(`extension package.json does not exist: ${packagePath}`)

  // not using require('package.json') because we need to reload if contents change
  const rawFileData = await readFile(packagePath)
  const config: ExtensionPackageConfig = fromJSON(rawFileData).or({})
  const id = `${config.publisher}.${config.name}`
  return { ...config, id, packagePath }
}

const getExtensionConfigsFromFS = async () => {
  const extensionDirs = await getDirs(EXT_PATH)
  // bundled extension dependencies reside in EXT_PATH/node_modules
  const dirs = extensionDirs.filter(dir => dir.name !== 'node_modules')
  const extensionPaths = await Promise.all(dirs.map(m => findPackageJson(m.path)))
  const configRequests = extensionPaths.map(path => getExtensionConfig(path))
  return Promise.all(configRequests)
}

const removeExtraneous = async (extensions: ExtensionPackageConfig[]) => {
  const dirs = await getDirs(EXT_PATH)
  const toRemove = dirs.filter(d => !extensions.some(e => e.id === d.name))
  // some built-in vscode extensions like typescript-language-features depends
  // on extension dependencies (node_modules) that is designed in such a way to
  // be shared between extensions. vscode does this by putting a node_modules
  // folder in the root directory of extensions. we mirror that setup here.
  // when removing extensions the node_modules dir will appear out of place
  // so we should just leave it intact. or remove it if no deps need it?
  const safeToRemove = toRemove.filter(m => m.name !== 'node_modules')
  const removeRequests = safeToRemove.map(dir => removePath(dir.path))
  return Promise.all(removeRequests)
}

const installMaybe = async (userDefinedExtensions?: string[]) => {
  if (!userDefinedExtensions) return
  await downloadExtensionsIfNotExist(EXT_PATH, userDefinedExtensions)

  const recursiveResolveExtensions = async (): Promise<ExtensionPackageConfig[]> => {
    const extensions = await getExtensionConfigsFromFS()
    const dependencies = extensions.reduce((exts, e) => [...exts, ...(e.extensionDependencies || [])], [] as string[])
    const extensionsNotInstalled = dependencies.filter(dep => !extensions.some(e => e.id === dep))

    if (!extensionsNotInstalled.length) return extensions
    await downloadExtensionsIfNotExist(EXT_PATH, extensionsNotInstalled)
    return recursiveResolveExtensions()
  }

  const resolvedExtensions = await recursiveResolveExtensions()
  doneDownloadingForNow()
  loadExtensions(resolvedExtensions)
  await removeExtraneous(resolvedExtensions)
}

nvim.getVarCurrentAndFuture('_veonim_extensions', installMaybe)

const extensionDependenciesDir = join(__dirname, '..', 'extension_dependencies')
const copyFrom = join(extensionDependenciesDir, 'node_modules')
const copyTo = join(EXT_PATH, 'node_modules')

ensureDir(LOG_PATH)
copy(copyFrom, copyTo, { overwrite: true }).catch(err => {
  console.error('failed to copy bundled extension dependencies', copyFrom, copyTo, err)
})
