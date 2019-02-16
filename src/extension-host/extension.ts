import { NewlineSplitter, getDirs, readFile, fromJSON, getFiles } from '../support/utils'
import { sep, dirname, join } from 'path'

export interface ExtensionConfig {
  name: string
  publisher: string
  extensionDependencies: string[]
}

export interface ExtensionInfo {
  name: string
  publisher: string
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

export interface Extension extends ExtensionInfo {
  config: any
  packagePath: string
  requirePath: string
  extensionDependencies: string[]
  activationEvents: ActivationEvent[]
  subscriptions: Set<Disposable>
  localize: Function
}

export default (config: any) => {
  const config = {}

  const parse = async () => {
    const { main, activationEvents = [], extensionDependencies = [] } = data
    const packagePath = dirname(packageJson)
    const languageFilePath = join(packagePath, 'package.nls.json')
    const localize = await LocalizeFile(languageFilePath)

    const parsedActivationEvents = activationEvents.map((m: string) => ({
      type: m.split(':')[0] as ActivationEventType,
      value: m.split(':')[1],
    }))

    Object.assign(config, {
      ...data,
      localize,
      packagePath,
      extensionDependencies,
      subscriptions: new Set(),
      requirePath: join(packagePath, main),
      activationEvents: parsedActivationEvents,
    })
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

    const context = { subscriptions: [] as any[] }

    const maybePromise = extension.activate(context)
    const isPromise = maybePromise && maybePromise.then
    if (isPromise) await maybePromise.catch((err: any) => console.error(extName, err))

    context.subscriptions.forEach(sub => e.subscriptions.add(sub))
    return context.subscriptions
  }

  parse()
  return {
    get config() { return {...config} },
    activate,
  }
}
