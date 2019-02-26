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

const builtinExtensions = [
  'vscode.typescript-language-features',
  'vscode.html-language-features',
  'vscode.css-language-features',
  'vscode.php-language-features',
  'vscode.json-language-features',
  'vscode.markdown-language-features',
]

export default async (location: string, extensions: string[]) => {
  const exts = await getExtensionsFromFS(location, extensions)
  const uninstalled = exts.filter(e => !e.installed)
  // TODO: need to report status visually to UI
  console.warn('uninstalled', uninstalled)

  const pendingDownloads = uninstalled.map(e => {
    const destination = join(location, `${e.publisher}.${e.name}`)
    const downloadUrl = builtinExtensions.includes(`${e.publisher}.${e.name}`)
      ? downloader.url.veonim(e.name)
      : downloader.url.vscode(e.publisher, e.name)

    return downloader.download(downloadUrl, destination)
  })

  const installed = await Promise.all(pendingDownloads)
  // TODO: need to report status visually to UI
  console.warn('installed', installed)

  return {
    ok: installed.filter(m => m).length,
    fail: installed.filter(m => !m).length,
  }
}

export const doneDownloadingForNow = () => downloader.dispose()
