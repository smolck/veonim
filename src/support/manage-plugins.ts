import { exists, getDirs, configPath, remove as removePath } from '../support/utils'
import { url, download } from '../support/download'
import { call } from '../messaging/worker-client'
import { NotifyKind } from '../protocols/veonim'
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

export default async (pluginText: string[]) => {
  const plugins = await getPlugins(pluginText).catch()
  const pluginsNotInstalled = plugins.filter(plug => !plug.installed)
  if (!pluginsNotInstalled.length) return removeExtraneous(plugins)

  call.notify(`Found ${pluginsNotInstalled.length} Veonim plugins. Installing...`, NotifyKind.System)

  const installed = await Promise.all(plugins.map(p => download(url.github(p.user, p.repo), p.path)))
  const installedOk = installed.filter(m => m).length
  const installedFail = installed.filter(m => !m).length

  if (installedOk) call.notify(`Installed ${installedOk} plugins!`, NotifyKind.Success)
  if (installedFail) call.notify(`Failed to install ${installedFail} plugins. See devtools console for more info.`, NotifyKind.Error)

  removeExtraneous(plugins)
  nvim.cmd(`packloadall!`)
}
