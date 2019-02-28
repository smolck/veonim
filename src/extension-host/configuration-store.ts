import nvim from '../neovim/api'

const store = {
  user: {},
  extensions: {},
  updates: {},
}

nvim.getVarCurrentAndFuture('vscode_config', config => Object.assign(store.user, config))
export const addExtensionConfiguration = (config: any) => Object.assign(store.extensions, config)
export const getConfig = () => ({ ...store.extensions, ...store.user, ...store.updates })
export const update = (section: string, value: any) => Reflect.set(store, section, value)
