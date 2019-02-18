import { addExtensionConfiguration } from '../extension-host/configuration-store'
import localizeFile from '../support/localize'
import pleaseGet from '../support/please-get'
import { dirname, join } from 'path'
import * as vsc from 'vscode'

export interface ExtensionPackageConfig {
  id: string
  packagePath: string
  name: string
  publisher: string
  extensionDependencies: string[]
  activationEvents: string[]
  main: string
}

export enum ActivationKind {
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
  type: ActivationKind
  value: string
}

export interface Extension extends vsc.Extension<any> {
  localize(value: string): Promise<string>
  dispose(): void
  activationEvents: ActivationEvent[]
}

const getContributesConfigurations = (config: ExtensionPackageConfig) => {
  const configuration: any = pleaseGet(config).contributes.configuration()
  if (!configuration) return

  if (configuration.type !== 'object') return console.error(`extension ${config.id} provided configuration is not of type object (could also be blank)`)
  if (!configuration.properties) return console.error(`idk, extension ${config.id} config does not have any properties. what am i supposed to do now?`)
  return Object.entries(configuration.properties).reduce((res, [ key, val ]) => {
    return Object.assign(res, { [key]: (val as any).default })
  }, {})
}

export default (config: ExtensionPackageConfig): Extension => {
  const extensionPath = dirname(config.packagePath)
  const requirePath = join(extensionPath, config.main)
  const languageFilePath = join(extensionPath, 'package.nls.json')
  const activationEvents = config.activationEvents.map((m: string) => ({
    type: m.split(':')[0] as ActivationKind,
    value: m.split(':')[1],
  }))

  const state = {
    subscriptions: [] as any[],
    isActive: false,
    exports: undefined,
  }

  const contributedConfiguration = getContributesConfigurations(config)
  if (contributedConfiguration) addExtensionConfiguration(contributedConfiguration)

  const localizer = localizeFile(languageFilePath)

  // TODO: i think we need to activate any extension dependencies (recursively)
  const activate = async () => {
    if (state.isActive) return
    console.log(`activation extension ${config.id}`)

    const extension = require(requirePath)
    if (!extension.activate) {
      console.error(`extension ${config.id} does not have a .activate() method`)
      return [] as any[]
    }

    const context: vsc.ExtensionContext = {
      subscriptions: state.subscriptions,
    }

    const api = await extension.activate(context).catch((err: any) => console.error(config.id, err))
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
    id: config.id,
    extensionPath,
    activationEvents,
    packageJSON: { ...config },
    get isActive () { return state.isActive },
    get exports () { return state.exports },
    activate,
    dispose,
    localize,
  }
}
