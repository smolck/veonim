import { exists, getDirs, is, configPath } from '../support/utils'
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

const packDir = join(configPath, 'nvim/pack')

const splitUserRepo = (text: string) => {
  const [ , user = '', repo = '' ] = (text.match(/^([^/]+)\/(.*)/) || [])
  return { user, repo }
}

const getPlugins = async (configLines: string[]) => Promise.all(configLines
  .filter(line => /^Plug(\s*)/.test(line))
  .map(line => (line.match(/^Plug(\s*)(?:"|')(\S+)(?:"|')/) || [])[2])
  .filter(is.string)
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
  console.log('toRemove', toRemove)

  // TODO: remove only plugins that were installed by veonim
  // toRemove.forEach(dir => removePath(dir.path))
}

export default async (configLines: string[]) => {
  const plugins = await getPlugins(configLines).catch()
  console.log('plugins', plugins)
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
