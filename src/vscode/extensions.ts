import makeExtensionObject, { Extension, ExtensionPackageConfig } from '../extension-host/extension'
import * as vsc from 'vscode'

const registry = new Map<string, Extension>()

const extensions: typeof vsc.extensions = {
  get all() { return [...registry.values()] },
  getExtension: (id: string) => registry.get(id),
}

export const loadExtensions = (configs: ExtensionPackageConfig[]) => {
  const extensions = configs.map(config => makeExtensionObject(config))
  extensions.forEach(ext => registry.set(ext.id, ext))
}

export default extensions
