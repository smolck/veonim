import { dirname, join, basename } from 'path'
import localizeFile from '../support/localize'
import { Omit } from '../support/types'

export interface ExtensionPackageConfig {
  name: string
  publisher: string
  extensionDependencies: string[]
  activationEvents: string[]
  main: string
}

interface ExtensionConfig extends Omit<ExtensionPackageConfig, 'activationEvents'> {
  packagePath: string
  requirePath: string
  activationEvents: ActivationEvent[]
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

export default (packageConfig: ExtensionPackageConfig, packageJsonPath: string) => {
  const packagePath = dirname(packageJsonPath)
  const requirePath = join(packagePath, packageConfig.main)
  const languageFilePath = join(packagePath, 'package.nls.json')
  const activationEvents = packageConfig.activationEvents.map((m: string) => ({
    type: m.split(':')[0] as ActivationEventType,
    value: m.split(':')[1],
  }))

  let subscriptions: any[] = []
  const localizer = localizeFile(languageFilePath)

  const config: ExtensionConfig = {
    ...packageConfig,
    packagePath,
    requirePath,
    activationEvents,
  }

  const activate = async () => {
    const requirePath = config.requirePath
    const extName = basename(requirePath)
    console.log('activating extension:', requirePath)

    const extension = require(requirePath)
    if (!extension.activate) {
      console.error(`extension ${extName} does not have a .activate() method`)
      return [] as any[]
    }

    const context = { subscriptions }
    await extension.activate(context).catch((err: any) => console.error(extName, err))
  }

  const localize = async (value: string) => (await localizer)(value)

  const dispose = () => {
    subscriptions.forEach(m => m())
    subscriptions = []
  }

  return {
    get config() { return { ...config } },
    localize,
    activate,
    dispose,
  }
}
