import { NewlineSplitter, getDirs, readFile, fromJSON, configPath, remove as removePath } from '../support/utils'
import downloadExtensionsIfNotExist, { doneDownloadingForNow } from '../extension-host/download-extensions'
import { ExtensionPackageConfig } from '../extension-host/extension'
import { loadExtensions } from '../vscode/extensions'
import { Ripgrep } from '../support/binaries'
import { sep, join } from 'path'
import nvim from '../neovim/api'

const EXT_PATH = join(configPath, 'veonim', 'extensions')

const findPackageJson = (path: string): Promise<string> => new Promise((done, fail) => {
  const results = [] as string[]
  const rg = Ripgrep(['--files', '--glob', '!node_modules', '--glob', `**/package.json`], { cwd: path }) 
  rg.stderr.pipe(new NewlineSplitter()).on('data', fail)
  rg.stdout.pipe(new NewlineSplitter()).on('data', (path: string) => results.push(path))
  rg.on('exit', () => {
    const paths = results.map(m => ({
      path: m,
      levels: m.split(sep).length,
    }))

    const orderedPaths = paths.sort((a, b) => a.levels - b.levels)
    done(orderedPaths[0].path)
  })
})

const getExtensionConfig = async (packagePath: string): Promise<ExtensionPackageConfig> => {
  // not using require('package.json') because we need to reload if contents change
  const rawFileData = await readFile(packagePath)
  return fromJSON(rawFileData).or({})
}

const getExtensionConfigsFromFS = async () => {
  const extensionDirs = await getDirs(EXT_PATH)
  const extensionPaths = await Promise.all(extensionDirs.map(m => findPackageJson(m.path)))
  const configRequests = extensionPaths.map(path => getExtensionConfig(path))
  return Promise.all(configRequests)
}

const removeExtraneous = async (extensions: ExtensionPackageConfig[]) => {
  const dirs = await getDirs(EXT_PATH)
  const extensionInstalled = (path: string) => extensions.some(e => `${e.publisher}.${e.name}` === path)
  const toRemove = dirs.filter(d => !extensionInstalled(d.path))
  const removeRequests = toRemove.map(dir => removePath(dir.path))
  return Promise.all(removeRequests)
}

export default async () => {
  const userDefinedExtensions = await nvim.g._vscode_extensions

  await downloadExtensionsIfNotExist(EXT_PATH, userDefinedExtensions)

  const recursiveResolveExtensions = async (): Promise<ExtensionPackageConfig[]> => {
    const extensions = await getExtensionConfigsFromFS()
    const dependencies = extensions.reduce((exts, e) => [...exts, ...e.extensionDependencies], [] as string[])
    const extensionsNotInstalled = dependencies.filter(dep => !extensions.some(e => `${e.publisher}.${e.name}` === dep))

    if (!extensionsNotInstalled.length) return extensions
    await downloadExtensionsIfNotExist(EXT_PATH, extensionsNotInstalled)
    return recursiveResolveExtensions()
  }

  const resolvedExtensions = await recursiveResolveExtensions()
  doneDownloadingForNow()
  loadExtensions(resolvedExtensions)
  await removeExtraneous(resolvedExtensions)
}
