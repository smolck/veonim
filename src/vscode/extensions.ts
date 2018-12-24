import { Extension, activateExtension } from '../extensions/extensions'
import * as vsc from 'vscode'

const extensionRepo = new Map<string, vsc.Extension<any>>()

const extensions: typeof vsc.extensions = {
  get all() { return [...extensionRepo.values()] },
  getExtension: (id: string) => extensionRepo.get(id),
}

export const registerExtension = (extension: Extension): void => {
  const { name, publisher, packagePath, config } = extension
  const id = `${publisher}:${name}`

  const ext: vsc.Extension<any> = {
    id,
    extensionPath: packagePath,
    isActive: false,
    packageJSON: config,
    exports: {},
    activate: async () => {
      // TODO: activateExtension returns subscriptions, but we want the exports here...
      const activateResult = await activateExtension(extension)
      Object.assign(ext, {
        isActive: true,
        exports: activateResult,
      })
    },
  }

  extensionRepo.set(id, ext)
}

export default extensions
