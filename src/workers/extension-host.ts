import { TextDocumentSyncKind, StreamMessageReader, StreamMessageWriter, createProtocolConnection, ProtocolConnection } from 'vscode-languageserver-protocol'
import { DebugConfiguration, collectDebuggersFromExtensions,
  getAvailableDebuggers, getLaunchConfigs, resolveConfigurationByProviders,
  getDebuggerConfig } from '../extensions/debuggers'
import { ExtensionInfo, Extension, ActivationEventType,
  Disposable, activateExtension } from '../extensions/extensions'
import DebugProtocolConnection, { DebugAdapterConnection } from '../messaging/debug-protocol'
import { readFile, fromJSON, is, uuid, getDirs, getFiles, merge, CreateTask, Task, configPath } from '../support/utils'
import updateLanguageServersWithTextDocuments from '../langserv/update-server'
import { on, call, request } from '../messaging/worker-client'
import { registerExtension } from '../vscode/extensions'
import { ChildProcess, spawn } from 'child_process'
import LocalizeFile from '../support/localize'
import pleaseGet from '../support/please-get'
import { dirname, join } from 'path'
import '../support/vscode-shim'
import '../extension-host/language-features'
import '../extension-host/language-events'

if (process.env.VEONIM_DEV) require('../dev/ext-host-development')

const EXT_PATH = join(configPath, 'veonim', 'extensions')

interface Debugger {
  type: string
  label: string
  program: string
  runtime?: 'node' | 'mono'
}

// TODO: THIS LEAKS OUTSIDE OF WORKER!
// need this flag to spawn node child processes. this will use the same node
// runtime included with electron. usually we would set this as an option in
// the spawn call, but we do not have access to the spawn calls in the
// extensions that are spawning node executables (language servers, etc.)
process.env.ELECTRON_RUN_AS_NODE = '1'

interface ActivateOpts {
  kind: string
  data: string
}

interface ServerBridgeParams {
  serverId: string
  method: string
  params: any[]
}

interface LanguageServer extends ProtocolConnection {
  textSyncKind: TextDocumentSyncKind
  pauseTextSync: boolean
  initializeTask: Task<void>
  untilInitialized: Promise<void>
}

const extensions = new Set<Extension>()
const languageExtensions = new Map<string, Extension>()
const runningLangServers = new Map<string, LanguageServer>()
const runningDebugAdapters = new Map<string, DebugAdapterConnection>()

on.load(() => load())

on.existsForLanguage((language: string) => Promise.resolve(languageExtensions.has(language)))

on.activate(({ kind, data }: ActivateOpts) => {
  if (kind === 'language') return activate.language(data)
})

on.listLaunchConfigs(() => getLaunchConfigs())
on.listDebuggers(async () => {
  const debuggers = await getAvailableDebuggers()
  return debuggers.map(d => {
    const localizedLabel = d.extension.localize(d.label)
    return { type: d.type, label: localizedLabel }
  })
})

on.startDebugWithConfig((folderUri: string, config: DebugConfiguration) => startDebugWithConfig(folderUri, config))
on.startDebugWithType((folderUri: string, type: string) => startDebugWithType(folderUri, type))

// TODO: deprecate?
on.startDebug((type: string) => start.debug(type))

const getServer = (id: string) => {
  const server = runningLangServers.get(id)
  if (!server) throw new Error(`fail to get serv ${id}. this should not happen... ever.`)
  return server
}

const getDebugAdapter = (id: string) => {
  const server = runningDebugAdapters.get(id)
  if (!server) throw new Error(`fail to get debug adapter ${id}. this should not happen... ever.`)
  return server
}

const getTextSyncKind = ({ capabilities: c }: any): TextDocumentSyncKind => {
  const syncKind = pleaseGet(c).textDocumentSync()
  if (syncKind == null) return TextDocumentSyncKind.None
  if (is.number(syncKind)) return syncKind
  return pleaseGet(c).textDocumentSync.change(TextDocumentSyncKind.None)
}

on.server_setTextSyncState((serverId: string, syncState: boolean) => {
  getServer(serverId).pauseTextSync = syncState
})

on.server_sendNotification(({ serverId, method, params }: ServerBridgeParams) => {
  const server = getServer(serverId)
  if (method === 'initialized') server.initializeTask.done(undefined)
  server.sendNotification(method as any, ...params)
})

on.server_sendRequest(async ({ serverId, method, params }: ServerBridgeParams) => {
  const server = getServer(serverId)
  const response = await server.sendRequest(method, ...params)
  if (method === 'initialize') server.textSyncKind = getTextSyncKind(response)
  return response
})

on.server_onNotification(({ serverId, method }: ServerBridgeParams) => {
  getServer(serverId).onNotification(method, (...args: any[]) => call[`${serverId}:${method}`](args))
})

on.server_onRequest(({ serverId, method }: ServerBridgeParams) => {
  getServer(serverId).onRequest(method, async (...args: any[]) => request[`${serverId}:${method}`](args))
})

on.server_onError(({ serverId }: ServerBridgeParams) => {
  getServer(serverId).onError((err: any) => call[`${serverId}:onError`](err))
})

on.server_onClose(({ serverId }: ServerBridgeParams) => {
  getServer(serverId).onClose(() => call[`${serverId}:onClose`]())
})

on.debug_sendRequest(({ serverId, command, args }: any) => {
  return getDebugAdapter(serverId).sendRequest(command, args)
})

on.debug_sendNotification(({ serverId, response }: any) => {
  getDebugAdapter(serverId).sendNotification(response)
})

on.debug_onNotification(({ serverId, method }: any) => {
  getDebugAdapter(serverId).onNotification(method, a => call[`${serverId}:${method}`](a))
})

on.debug_onRequest(({ serverId }: any) => {
  getDebugAdapter(serverId).onRequest(a => call[`${serverId}:onRequest`](a))
})

on.debug_onError(({ serverId }: any) => {
  getDebugAdapter(serverId).onError(a => call[`${serverId}:onError`](a))
})

on.debug_onClose(({ serverId }: any) => {
  getDebugAdapter(serverId).onClose(() => call[`${serverId}:onClose`]())
})

// so we download the zip file into user--repo dir. this dir will then contain
// a folder with the extension contents. it will look something like the following:
// ~/.config/veonim/extensions/veonim--ext-json/ext-json-master/package.json
// ~/.config/veonim/extensions/vspublisher--vscode-extension/extension/package.json
const findPackageJson = async (packageDir: string) => {
  const [ firstDir ] = await getDirs(packageDir)
  if (!firstDir) throw new Error(`empty package dir: ${packageDir}`)

  const filesInDir = await getFiles(firstDir.path)
  const packagePath = filesInDir.find(m => m.path.endsWith('package.json'))
  return (packagePath || {} as any).path
}

const findExtensions = async () => {
  const extensionDirs = await getDirs(EXT_PATH)
  return Promise.all(extensionDirs.map(m => findPackageJson(m.path)))
}

const parseExtensionDependency = (extString: string): ExtensionInfo => {
  const [ publisher, name ] = extString.split('.')
  return { publisher, name }
}

const findExtensionDependency = ({ name, publisher }: ExtensionInfo) => [...extensions]
  .find(e => e.name === name && e.publisher === publisher)

// TODO: handle recursive dependencies. THIS IDEA SUCKS WTF
const installExtensionsIfNeeded = (extensions: string[]) => extensions
  .map(parseExtensionDependency)
  .map(e => ({ ...e, installed: !!findExtensionDependency(e) }))
  .forEach(e => {
    if (!e.installed) console.warn('NYI: please install extension dependency:', e)
    // TODO: actually install it lol
    // and do the whole package.json parse routine
    // and we need to do it recursively... sheesh great design here
  })

const getPackageJsonConfig = async (packageJson: string): Promise<Extension> => {
  const rawFileData = await readFile(packageJson)
  const config = fromJSON(rawFileData).or({})
  const { name, publisher, main, activationEvents = [], extensionDependencies = [] } = config
  const packagePath = dirname(packageJson)
  const languageFilePath = join(packagePath, 'package.nls.json')
  const localize = await LocalizeFile(languageFilePath)

  const parsedActivationEvents = activationEvents.map((m: string) => ({
    type: m.split(':')[0] as ActivationEventType,
    value: m.split(':')[1],
  }))

  return {
    name,
    config,
    localize,
    publisher,
    packagePath,
    extensionDependencies,
    subscriptions: new Set(),
    requirePath: join(packagePath, main),
    activationEvents: parsedActivationEvents,
  }
}

const load = async () => {
  const extensionPaths = await findExtensions()
  const extensionsWithConfig = await Promise.all(extensionPaths.map(m => getPackageJsonConfig(m)))

  extensions.clear()

  extensionsWithConfig.forEach(ext => {
    extensions.add(ext)
    registerExtension(ext)

    if (ext.extensionDependencies.length) installExtensionsIfNeeded(ext.extensionDependencies)

    ext.activationEvents
      .filter(a => a.type === ActivationEventType.Language)
      .forEach(a => languageExtensions.set(a.value, ext))
  })

  collectDebuggersFromExtensions(extensionsWithConfig)
}

const connectRPCServer = (proc: ChildProcess): string => {
  const serverId = uuid()

  const reader = new StreamMessageReader(proc.stdout)
  const writer = new StreamMessageWriter(proc.stdin)
  const conn = createProtocolConnection(reader, writer, console)

  conn.listen()

  const initializeTask = CreateTask()

  Object.assign(conn, {
    initializeTask,
    pauseTextSync: false,
    untilInitialized: initializeTask.promise,
  })

  runningLangServers.set(serverId, conn as LanguageServer)
  return serverId
}

const activateExtensionForLanguage = async (language: string) => {
  const extension = languageExtensions.get(language)
  if (!extension) {
    console.error(`extension for ${language} not found`)
    return []
  }

  return activateExtension(extension)
}

// TODO: we should build a new activation mechanism that relies on
// filetypes. it should have no interaction with instance thread
const activate = {
  language: async (language: string) => {
    // TODO: handle extension dependencies
    const extensionDisposables = await activateExtensionForLanguage(language)
    // TODO: need to call these disposables when extension deactivates
    // TODO: when do extensions deactivate?
    console.log('extensionDisposables', extensionDisposables)
    console.log('language', language)
    return ''
  },
}

/*
 * Start a debugger with a given launch.json configuration chosen by user
 */
const startDebugWithConfig = async (cwd: string, config: DebugConfiguration) => {
  const launchConfig = await resolveConfigurationByProviders(cwd, config.type, config)

  // TODO: start debugger
  console.log('start debugger with config:', launchConfig)

  return { launchConfig, serverId: -1 }
}

/*
 * Start a debugger with a given debug 'type'. This is a debugger chosen
 * by the user after calling 'getAvailableDebuggers'. The configuration
 * will be resolved automagically by via configs provided in extension
 * package.json and/or via DebugConfigurationProvider
 */
const startDebugWithType = async (cwd: string, type: string) => {
  const launchConfig = await getDebuggerConfig(cwd, type)
  if (!launchConfig) return console.error(`can not start debugger ${type}`)

  // TODO: start debugger
  console.log('start debugger with config:', launchConfig)

  return { launchConfig, serverId: -1 }
}

const start = {
  debug: async (type: string) => {
    // TODO: only activate extensions for 'onDebug'
    // other events are called by getting config fns...

    const { extension, debug } = getDebug(type)
    if (!extension) return console.error(`extension for ${type} not found`)

    // TODO: handle recursive extension dependencies
    const activations = extension.extensionDependencies
      .map(parseExtensionDependency)
      .map(e => ({ ...e, ...findExtensionDependency(e) }))
      .map(async e => {
        const extInstalled = (e as Extension).requirePath
        if (!extInstalled) {
          console.error(`extension ${e.name} was not installed before activation`)
          return { dispose: () => {} } as Disposable
        }
        // TODO: only activate if has relevant activation events???? or always activate?
        return activateExtension(e as Extension)
      })

    // TODO: do something with the subscriptions? for later cleanup purposes?
    await Promise.all(activations)

    // TODO: do something with the subscriptions? for later cleanup purposes?
    // TODO: only activate if has relevant activation events???? or always activate?
    await activateExtension(extension)

    // debug activationEvents:
    // - onDebug
    // - onDebugResolve:${type} - wut?
    // - onDebugInitialConfigurations - wut?

    return startDebugger(extension, debug)
  },
}

const getDebug = (type: string) => [...extensions].reduce((res, extension) => {
  const debuggers = pleaseGet(extension.config).contributes.debuggers([])
  const debug = debuggers.find((d: any) => d.type === type)
  return debug ? merge(res, { extension, debug }) : res
}, {} as { extension: Extension, debug: Debugger })

const connectDebugAdapter = (proc: ChildProcess): string => {
  const serverId = uuid()
  const conn = DebugProtocolConnection(proc.stdout, proc.stdin)
  runningDebugAdapters.set(serverId, conn)
  return serverId
}

const startDebugger = (extension: Extension, debug: Debugger) => {
  const adapterPath = join(extension.packagePath, debug.program)
  const proc = startDebugAdapter(adapterPath, debug.runtime)

  // TODO: testing
  proc.stderr.on('data', err => console.error(debug.type, 'errrrrrrr:' + err + ''))
  // TODO: testing

  return connectDebugAdapter(proc)
}

const startDebugAdapter = (debugAdapterPath: string, runtime: Debugger['runtime']): ChildProcess => {
  // TODO: do we need to accept any arguments from launch.json config? (whether user provided or generated)
  const spawnOptions = {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  }

  let proc

  // if a runtime is not provided, then the debug adapter is a binary executable
  // TODO: support cross-platform executables (see docs for examples)
  // by the way, different platforms may require different executables. see the docs
  // for example combinations of program/runtime
  if (!runtime) proc = spawn(debugAdapterPath, [], spawnOptions)
  else if (runtime === 'node') proc = spawn(process.execPath, [debugAdapterPath], spawnOptions)
  // TODO: figure out how to start a debug adapter with "mono" runtime
  // i do not believe mono runtime comes with vscode (would be surprised if it did)
  // the vscode-mono-debug extension readme asks that the user install mono
  // separately. that means we just need to figure out how to start/run mono
  // if installed and start the debug adapter with it (i.e. is mono in $PATH, etc.)
  else if (runtime === 'mono') throw new Error('debug adapter runtime "mono" not supported yet, but it should!')
  else throw new Error(`invalid debug adapter runtime provided: ${runtime}. are we supposed to support this?`)

  return proc
}
