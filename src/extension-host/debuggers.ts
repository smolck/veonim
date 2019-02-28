// TODO: this whole file is fucked right now. need to rework it once we have vscode extensions setup
// import { Extension, activateExtension } from '../extensions/extensions'
import pleaseGet from '../support/please-get'
import { merge } from '../support/utils'
import * as vsc from 'vscode'

export interface DebugConfiguration {
  name: string
  request: string
  type: string
  [index: string]: any
}

interface Debugger {
  type: string
  label: string
  program: string
  runtime?: 'node' | 'mono'
  initialConfigurations?: DebugConfiguration[]
  hasInitialConfiguration: boolean
  hasConfigurationProvider: boolean
  // @ts-ignore
  extension: Extension
  debugConfigProviders: Set<vsc.DebugConfigurationProvider>
}

const debuggers = new Map<string, Debugger>()

// @ts-ignore
const getExtensionDebuggers = (extension: Extension): Debugger[] => {
  const debuggers = pleaseGet(extension.config).contributes.debuggers([]) as any[]

  return debuggers.map(d => ({
    extension,
    type: d.type,
    label: d.label,
    program: d.program,
    runtime: d.runtime,
    initialConfigurations: d.initialConfigurations,
    debugConfigProviders: new Set(),
    hasInitialConfiguration: !!d.initialConfigurations,
    hasConfigurationProvider: false,
  }))
}

const getProviders = (type: string) => {
  const dbg = debuggers.get(type)

  if (!dbg) {
    console.error(`could not get debug providers for ${type}`)
    return []
  }

  return [...dbg.debugConfigProviders.values()]
}

const activateDebuggersByEvent = async (eventType: string) => {
  const activations = [...debuggers.values()]
  // @ts-ignore
    .filter(d => d.extension.activationEvents.some(ae => ae.type === eventType))
    // @ts-ignore
    .map(d => activateExtension(d.extension))

  return Promise.all(activations)
}

const getInitialConfig = (dbg: Debugger, cwd: string): DebugConfiguration => {
  const providers = [...dbg.debugConfigProviders.values()]
  const initialConfigsStatic = dbg.initialConfigurations || []

  const initialConfigsDynamic = providers
    .filter(p => p.provideDebugConfigurations)
  // TODO: hmmm check type here!?
  // TODO: hmmm check type here!?
  // TODO: hmmm check type here!?
  // TODO: hmmm check type here!?
  // TODO: hmmm check type here!?
  // TODO: hmmm check type here!?
  // TODO: hmmm check type here!?
  // TODO: hmmm check type here!?
  // TODO: hmmm check type here!?
  // TODO: hmmm check type here!?
  // @ts-ignore
    .map(p => p.provideDebugConfigurations!(cwd))
    .reduce((res, config) => [...res, ...config], [] as DebugConfiguration[])

  const initialConfigs = [...initialConfigsStatic, ...initialConfigsDynamic]
  return initialConfigs.reduce((res, config) => merge(res, config), {} as DebugConfiguration)
}

/*
 * Get debugger config. Should probably be called after "getAvailableDebuggers"
 * and user chooses a specific debugger to start debugging with.
 */
export const getDebuggerConfig = async (cwd: string, type: string) => {
  const dbg = debuggers.get(type)
  if (!dbg) return console.error(`the debugger ${type} does not exist. lolwat`)

  const initialConfig = getInitialConfig(dbg, cwd)
  return resolveConfigurationByProviders(cwd, type, initialConfig)
}

export const getAvailableDebuggers = async (): Promise<Debugger[]> => {
  await activateDebuggersByEvent('onDebugInitialConfigurations')
  await activateDebuggersByEvent('onDebug')
  return [...debuggers.values()].filter(d => d.hasInitialConfiguration || d.hasConfigurationProvider)
}

export const getLaunchConfigs = async (): Promise<DebugConfiguration[]> => {
  // TODO: get launch.json configs
  return []
}

/*
 * Resolve a debug configuration from either an inital config or no config.
 *
 * Gets called from either of the following scenarios (in the following order)
 *
 * - We have a configuration from launch.json and we need to resolve it further
 * - We have an initial configuration from "initialConfigurations" or "provideDebugConfigurations"
 * - We have no configuration at all
 */
export const resolveConfigurationByProviders = async (cwd: string, type: string, config = {} as DebugConfiguration): Promise<DebugConfiguration> => {
  await activateDebuggersByEvent(`onDebugResolve:${type}`)
  type UghWTF = Promise<DebugConfiguration>
  return getProviders(type)
    .filter(p => p.resolveDebugConfiguration)
    .reduce((q: UghWTF, provider: vsc.DebugConfigurationProvider) => q.then(config => config
      // TODO: hmm?? check type here
      // TODO: hmm?? check type here
      // TODO: hmm?? check type here
      // TODO: hmm?? check type here
      // TODO: hmm?? check type here
      // TODO: hmm?? check type here
      // TODO: hmm?? check type here
      // @ts-ignore
      ? provider.resolveDebugConfiguration!(cwd, config)
      : Promise.resolve(config)
    ), Promise.resolve(config))
}

/*
 * Collect debuggers from the list of extensions
 *
 * This function should only be called when we load extensions. Loading
 * extensions reloads ALL extensions whether they were loaded before or not.
 * this means we should reset the collection of debuggers from any previous
 * extension loadings
 */
// @ts-ignore
export const collectDebuggersFromExtensions = (extensions: Extension[]): void => {
  debuggers.clear()

  extensions.forEach(ext => {
    const dbgs = getExtensionDebuggers(ext)
    dbgs.forEach(dbg => debuggers.set(dbg.type, dbg))
  })
}

export const registerDebugConfigProvider = (type: string, provider: vsc.DebugConfigurationProvider) => {
  if (!provider) return

  const dbg = debuggers.get(type)
  if (!dbg) return console.error(`can't register debug config provider. debugger ${type} does not exist.`)

  dbg.debugConfigProviders.add(provider)
  dbg.hasConfigurationProvider = true

  return () => {
    if (dbg.debugConfigProviders.has(provider)) dbg.debugConfigProviders.delete(provider)
  }
}
