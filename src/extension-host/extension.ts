import { dirname, join, basename } from 'path'
import localizeFile from '../support/localize'
import * as vsc from 'vscode'

export interface ExtensionPackageConfig {
  packagePath: string
  name: string
  publisher: string
  extensionDependencies: string[]
  activationEvents: string[]
  main: string
}

export enum ActivationEventType {
  WorkspaceContains = 'workspaceContains',
  Language = 'onLanguage',
  Command = 'onCommand',
  Debug = 'onDebug',
  DebugInitialConfigs = 'onDebugInitialConfigurations',
  DebugResolve = 'onDebugResolve',
  View = 'onView',
  Always  = '*',
}

interface ActivationEvent {
  type: ActivationEventType
  value: string
}

export interface Extension extends vsc.Extension<any> {
  localize(value: string): Promise<string>
  dispose(): void
}

export default (config: ExtensionPackageConfig): Extension => {
  const extensionPath = dirname(config.packagePath)
  const requirePath = join(extensionPath, config.main)
  const languageFilePath = join(extensionPath, 'package.nls.json')
  const activationEvents = config.activationEvents.map((m: string) => ({
    type: m.split(':')[0] as ActivationEventType,
    value: m.split(':')[1],
  }))

  const state = {
    subscriptions: [] as any[],
    isActive: false,
    exports: undefined,
  }

  const localizer = localizeFile(languageFilePath)

  // TODO: i think we need to activate any extension dependencies (recursively)
  const activate = async () => {
    const extName = basename(requirePath)
    console.log('activating extension:', requirePath)

    const extension = require(requirePath)
    if (!extension.activate) {
      console.error(`extension ${extName} does not have a .activate() method`)
      return [] as any[]
    }

    const context = { subscriptions: state.subscriptions }
    const api = await extension.activate(context).catch((err: any) => console.error(extName, err))
    state.exports = api
    state.isActive = true
  }

  const localize = async (value: string) => (await localizer)(value)

  const dispose = () => {
    state.subscriptions.forEach(m => m())
    state.subscriptions = []
    state.exports = undefined
    state.isActive = false
  }

  return {
    id: `${config.publisher}.${config.name}`,
    extensionPath,
    packageJSON: { ...config },
    get isActive () { return state.isActive },
    get exports () { return state.exports },
    activate,
    dispose,
    localize,
  }
}
