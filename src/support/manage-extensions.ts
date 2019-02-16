import { exists, getDirs, remove as removePath, configPath } from '../support/utils'
import { load as loadExtensions } from '../core/extensions-api'
import * as downloader from '../support/download'
import { call } from '../messaging/worker-client'
import { NotifyKind } from '../protocols/veonim'
import { join } from 'path'

const EXT_PATH = join(configPath, 'veonim', 'extensions')

interface Extension {
  dirname: string,
  publisher: string,
  name: string,
  installed: boolean,
}

enum ExtensionKind {
  Github,
  VSCode,
}

const parseExtensionDefinition = (text: string) => {
  const [ publisher, name ] = text.split('.')
  return { publisher, name }
}

const getExtensions = async (texts: string[]) => Promise.all(texts
  .map(parseExtensionDefinition)
  .map(async m => {
    const dirname = `${m.publisher}--${m.name}`

    return {
      ...m,
      dirname,
      installed: await exists(join(EXT_PATH, dirname)),
    }
  }))

const removeExtraneous = async (extensions: Extension[]) => {
  const dirs = await getDirs(EXT_PATH)
  const extensionInstalled = (path: string) => extensions.some(e => e.dirname === path)
  const toRemove = dirs.filter(d => !extensionInstalled(d.dirname))

  toRemove.forEach(dir => removePath(dir.path))
}

export default async (extText: string[]) => {
  const extensions = await getExtensions(extText).catch()
  const extensionsNotInstalled = extensions.filter(ext => !ext.installed)

  // TODO: this needs to be done at the end of everything
  // if (!extensionsNotInstalled.length) return removeExtraneous(extensions)

  call.notify(`Found ${extensionsNotInstalled.length} extensions. Installing...`, NotifyKind.System)

  const installed = await Promise.all(extensions.map(e => {
    const destination = join(EXT_PATH, `${e.publisher}--${e.name}`)
    const downloadUrl = e.publisher === 'veonim'
      ? downloader.url.veonim(e.name)
      : downloader.url.vscode(e.publisher, e.name)

    return downloader.download(downloadUrl, destination)
  }))

  const installedOk = installed.filter(m => m).length
  const installedFail = installed.filter(m => !m).length

  if (installedOk) call.notify(`Installed ${installedOk} extensions!`, NotifyKind.Success)
  if (installedFail) call.notify(`Failed to install ${installedFail} extensions. See devtools console for more info.`, NotifyKind.Error)

  // TODO: at the end!
  // removeExtraneous(extensions)
  loadExtensions()
}
