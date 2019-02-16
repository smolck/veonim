import * as downloader from '../support/download'
import { exists } from '../support/utils'
import { join } from 'path'

const parseExtensionDefinition = (text: string) => {
  const [ publisher, name ] = text.split('.')
  return { publisher, name }
}

const getExtensionsFromFS = async (location: string, extensions: string[]) => Promise.all(extensions
  .map(parseExtensionDefinition)
  .map(async m => {
    const dirname = `${m.publisher}.${m.name}`

    return {
      ...m,
      dirname,
      installed: await exists(join(location, dirname)),
    }
  }))

export default async (location: string, extensions: string[]) => {
  const exts = await getExtensionsFromFS(location, extensions)
  const uninstalled = exts.filter(e => !e.installed)

  const pendingDownloads = uninstalled.map(e => {
    const destination = join(location, `${e.publisher}.${e.name}`)
    const downloadUrl = e.publisher === 'veonim'
      ? downloader.url.veonim(e.name)
      : downloader.url.vscode(e.publisher, e.name)

    return downloader.download(downloadUrl, destination)
  })

  const installed = await Promise.all(pendingDownloads)

  return {
    ok: installed.filter(m => m).length,
    fail: installed.filter(m => !m).length,
  }
}

export const doneDownloadingForNow = () => downloader.dispose()
