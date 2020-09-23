import { showProgressMessage, showMessage } from '../extension-host/bridge-api'
import { MessageKind } from '../protocols/veonim'
import * as downloader from '../support/download'
import { exists } from '../support/utils'
import { join } from 'path'

const parseExtensionDefinition = (text: string) => {
  const [publisher, name] = text.split('.')
  return { publisher, name }
}

const getExtensionsFromFS = async (location: string, extensions: string[]) =>
  Promise.all(
    extensions.map(parseExtensionDefinition).map(async (m) => {
      const dirname = `${m.publisher}.${m.name}`

      return {
        ...m,
        dirname,
        installed: await exists(join(location, dirname)),
      }
    })
  )

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
  const uninstalled = exts.filter((e) => !e.installed)
  if (!uninstalled.length) return

  const installProgress = await showProgressMessage({
    message: 'Downloading and installing VSCode extensions',
    kind: MessageKind.Progress,
    progressCancellable: false,
  })

  installProgress.setProgress({
    percentage: 3,
    status: `Downloading ${uninstalled.length} VSCode extensions`,
  })

  // forEach extension download + unzip
  const totalTasks = uninstalled.length * 2
  let currentTaskProgress = 0

  const pendingDownloads = uninstalled.map((e) => {
    const destination = join(location, `${e.publisher}.${e.name}`)
    const downloadUrl = builtinExtensions.includes(`${e.publisher}.${e.name}`)
      ? downloader.url.veonim(e.name)
      : downloader.url.vscode(e.publisher, e.name)

    return downloader.download(downloadUrl, destination, e.name, (status) => {
      currentTaskProgress++
      const percentage = Math.round((currentTaskProgress / totalTasks) * 100)
      installProgress.setProgress({ percentage, status })
    })
  })

  const installed = await Promise.all(pendingDownloads)

  const success = installed.filter((m) => m).length === installed.length
  const failedCount = installed.filter((m) => !m).length

  installProgress.remove()

  if (success)
    showMessage({
      message: `Succesfully installed ${installed.length} VSCode extensions`,
      kind: MessageKind.Success,
    })
  else
    showMessage({
      // TODO: would be super nice to list the problems in the UI somehow...
      message: `Failed to install ${failedCount} / ${installed.length} VSCode extensions. Check logs for details`,
      kind: MessageKind.Error,
    })
}
