import { addExtensionConfiguration } from '../extension-host/configuration-store'
import { EXT_DATA_PATH, LOG_PATH } from '../support/config-paths'
import localizeFile from '../support/localize'
import pleaseGet from '../support/please-get'
import { dirname, join } from 'path'
import { createHash } from 'crypto'
import nvim from '../neovim/api'
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

const createMemento = (): vsc.Memento => {
  const get = <T>(key: string, defaultValue?: T): T => {

  }

  const update = async (key: string, value: any) => {

  }

  return { get, update }
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
    workspaceState: createMemento(),
    globalState: createMemento(),
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

    const workspaceId = createHash('md5').update(nvim.state.cwd).digest('hex')

    const context: vsc.ExtensionContext = {
      extensionPath,
      subscriptions: state.subscriptions,
      asAbsolutePath: relpath => join(extensionPath, relpath),
      globalStoragePath: join(EXT_DATA_PATH, config.id),
      storagePath: join(EXT_DATA_PATH, `${workspaceId}-${config.id}`),
      logPath: join(LOG_PATH, config.id),
      workspaceState: state.workspaceState,
      globalState: state.globalState,
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
