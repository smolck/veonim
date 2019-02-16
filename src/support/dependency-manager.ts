import { load as loadExtensions } from '../core/extensions-api'
import installExtensions from '../support/manage-extensions'
import installPlugins from '../support/manage-plugins'
import { isOnline } from '../support/utils'
import nvim from '../neovim/api'

const refreshDependencies = async () => {
  const online = await isOnline('google.com')
  if (!online) return

  const [ plugins, extensions ] = await Promise.all([
    nvim.g._veonim_plugins,
    nvim.g._veonim_extensions,
  ])

  installExtensions(extensions).then(loadExtensions)
  installPlugins(plugins)
}

// TODO: how to detect change on vimrc?
// nvim.onVimrcLoad(refreshDependencies)
refreshDependencies()
