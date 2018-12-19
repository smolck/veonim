import { configPath, readFile, exists, isOnline } from '../support/utils'
import installExtensions from '../support/manage-extensions'
import installPlugins from '../support/manage-plugins'
import { join } from 'path'

const vimrcPath = join(configPath, 'nvim/init.vim')

const getVimrcLines = async () => (await readFile(vimrcPath))
  .toString()
  .split('\n')

const refreshDependencies = async () => {
  const online = await isOnline('github.com')
  if (!online) return

  const vimrcExists = await exists(vimrcPath)
  if (!vimrcExists) return

  const configLines = await getVimrcLines()
  installExtensions(configLines)
  installPlugins(configLines)
}

export default () => {
  // TODO: refresh dependencies when vimrc config reloaded
  refreshDependencies()
}
