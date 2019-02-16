// TODO: remove this file
import { ExtensionPackageConfig } from '../extension-host/extension'
import Extension from '../extension-host/extension'
import * as vsc from 'vscode'

const registry = new Map<string, vsc.Extension<any>>()

const extensions: typeof vsc.extensions = {
  get all() { return [...registry.values()] },
  getExtension: (id: string) => registry.get(id),
}

export const loadExtensions = (configs: ExtensionPackageConfig[]) => {
  // TODO: need the package json path!
  const extensions = configs.map(config => Extension(config))
  // TODO: do this better
  extensions.forEach(ext => registry.set(id, ext))
}

// TODO: deprecate
// export const registerExtension = (extension: Extension): void => {
//   const { name, publisher, packagePath, config } = extension
//   const id = `${publisher}:${name}`

//   const ext: vsc.Extension<any> = {
//     id,
//     extensionPath: packagePath,
//     isActive: false,
//     packageJSON: config,
//     exports: {},
//     activate: async () => {
//       // TODO: activateExtension returns subscriptions, but we want the exports here...
//       const activateResult = await activateExtension(extension)
//       Object.assign(ext, {
//         isActive: true,
//         exports: activateResult,
//       })
//     },
//   }

//   registry.set(id, ext)
// }

export default extensions
