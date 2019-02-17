import makeExtensionObject, { Extension, ExtensionPackageConfig, ActivationKind } from '../extension-host/extension'
import { MapSetter } from '../support/utils'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

const registry = new Map<string, Extension>()

const extensions: typeof vsc.extensions = {
  get all() { return [...registry.values()] },
  getExtension: (id: string) => registry.get(id),
}

const activators = {
  language: new MapSetter<string, Extension>(),
}

export const loadExtensions = (configs: ExtensionPackageConfig[]) => {
  registry.clear()
  const extensions = configs.map(config => makeExtensionObject(config))
  extensions.forEach(ext => registry.set(ext.id, ext))
  setupExtensionActivations()
}

const setupExtensionActivations = () => {
  activators.language.clear()
  ;[...registry.values()].forEach(setupActivation)
}

const setupActivation = (ext: Extension) => ext.activationEvents.forEach(event => {
  if (event.type === ActivationKind.Always) return ext.activate()
  if (event.type === ActivationKind.Language) return activators.language.add(event.value, ext)
})

nvim.on.filetype(filetype => {
  activators.language.getList(filetype).forEach(ext => ext.activate())
})

export default extensions
