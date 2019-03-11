import { isOnline, exists, getDirs, configPath, remove as removePath } from '../support/utils'
import * as downloader from '../support/download'
import { call } from '../messaging/worker-client'
import { MessageKind } from '../protocols/veonim'
import nvim from '../neovim/api'
import { join } from 'path'

interface Plugin {
  name: string,
  user: string,
  repo: string,
  path: string,
  installed: boolean,
}

// veonim will not touch plugins installed by user or other package manager
// this is because we do not want to delete any data that veonim did not add
const packDir = join(configPath, 'nvim', 'pack', 'veonim-installed-plugins')

const splitUserRepo = (text: string) => {
  const [ , user = '', repo = '' ] = (text.match(/^([^/]+)\/(.*)/) || [])
  return { user, repo }
}

const getPlugins = async (texts: string[]) => Promise.all(texts
  .map(splitUserRepo)
  .map(async m => {
    const name = `${m.user}-${m.repo}`
    const path = join(packDir, name)
    return {
      ...m,
      name,
      path: join(path, 'start'),
      installed: await exists(path),
    }
  }))

const removeExtraneous = async (plugins: Plugin[]) => {
  const dirs = await getDirs(packDir)
  const pluginInstalled = (path: string) => plugins.some(e => e.name === path)
  const toRemove = dirs.filter(d => !pluginInstalled(d.name))

  toRemove.forEach(dir => removePath(dir.path))
}

const download = async (pluginText: string[]) => {
  const online = await isOnline('google.com')
  if (!online) return console.error('cant download plugins - no internet connection')

  const plugins = await getPlugins(pluginText).catch()
  const pluginsNotInstalled = plugins.filter(plug => !plug.installed)
  if (!pluginsNotInstalled.length) return removeExtraneous(plugins)

  call.showVSCodeMessage({
    message: `Found ${pluginsNotInstalled.length} Veonim plugins. Installing...`,
    kind: MessageKind.System,
  })

  const installed = await Promise.all(plugins.map(p => downloader.download(downloader.url.github(p.user, p.repo), p.path)))
  const installedOk = installed.filter(m => m).length
  const installedFail = installed.filter(m => !m).length

  if (installedOk) call.showVSCodeMessage({
    message: `Installed ${installedOk} plugins!`,
    kind: MessageKind.Success,
  })

  if (installedFail) call.showVSCodeMessage({
    message: `Failed to install ${installedFail} plugins. See devtools console for more info.`,
    kind: MessageKind.Error,
  })

  removeExtraneous(plugins)
  nvim.cmd(`packloadall!`)
}

export default () => nvim.getVarCurrentAndFuture('_veonim_plugins', download)
