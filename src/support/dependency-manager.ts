import installExtensions from '../support/manage-extensions'
import installPlugins from '../support/manage-plugins'
import { isOnline } from '../support/utils'
import nvim from '../neovim/api'

const refreshDependencies = async () => {
  const online = await isOnline('github.com')
  if (!online) return

  const [ plugins, extensions ] = await Promise.all([
    nvim.g._veonim_plugins,
    nvim.g._veonim_extensions,
  ])

  installExtensions(extensions)
  installPlugins(plugins)
}

nvim.onVimrcLoad(refreshDependencies)
refreshDependencies()
