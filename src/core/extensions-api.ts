import { DebugAdapterConnection } from '../messaging/debug-protocol'
import { DiagnosticsEvent } from '../extension-host/language-events'
import { Providers } from '../extension-host/providers'
import { workerData } from '../messaging/worker-client'
import { threadSafeObject } from '../support/utils'
import nvimSyncApiHandler from '../neovim/sync-api'
import Worker from '../messaging/worker'
import { uuid } from '../support/utils'

// TODO: move to shared place
interface DebugConfiguration {
  name: string
  request: string
  type: string
  [index: string]: any
}

export interface DebuggerInfo {
  label: string
  type: string
}

export interface DebugStarterPack {
  connection: DebugAdapterConnection
  launchConfig: DebugConfiguration
}

const { on, call, request, onContextHandler } = Worker('extension-host', {
  workerData,
  sharedMemorySize: (1024**2) * 4,
})

onContextHandler(nvimSyncApiHandler)

on.clipboardRead(request.clipboardRead)
on.clipboardWrite(call.clipboardWrite)

const providerBridge: Providers = new Proxy(Object.create(null), {
  get: (_: any, method: string) => (...args: any[]) => {
    const id = uuid()
    return {
      cancel: () => call.provider_cancel(id),
      promise: request.provider(method, args.map(threadSafeObject), id),
    }
  }
})

export const vscode = {
  language: providerBridge,
  onDiagnostics: (fn: (event: DiagnosticsEvent[]) => void) => on.diagnostics(fn),
  commands: {
    executeCommand: (command: string, ...args: any[]) => request.commands_execute(command, args),
  },
  textSync: {
    pause: () => call.set_text_sync_state(false),
    resume: () => call.set_text_sync_state(true),
  },
}

const bridgeDebugAdapterServer = (serverId: string): DebugAdapterConnection => {
  const api = {} as DebugAdapterConnection

  api.sendRequest = (command, args) => request.debug_sendRequest({ serverId, command, args })
  api.sendNotification = (response) => call.debug_sendNotification({ serverId, response })

  api.onNotification = (method, cb) => {
    call.debug_onNotification({ serverId, method })
    on[`${serverId}:${method}`]((args: any) => cb(args))
  }

  api.onRequest = cb => {
    call.debug_onRequest({ serverId })
    on[`${serverId}:onRequest`]((args: any) => cb(args))
  }

  api.onError = cb => {
    call.debug_onError({ serverId })
    on[`${serverId}:onError`]((args: any) => cb(args))
  }

  api.onClose = cb => {
    call.debug_onClose({ serverId })
    on[`${serverId}:onClose`](() => cb())
  }

  return api
}

export const load = () => call.load()
export const listDebuggers = () => request.listDebuggers()

export const list = {
  debuggers: (): Promise<{ type: string, label: string }[]> => request.listDebuggers(),
  launchConfigs: (): Promise<DebugConfiguration[]> => request.listLaunchConfigs(),
}

export const start = {
  // TODO: deprecate?
  debug: async (type: string): Promise<DebugAdapterConnection> => {
    const serverId = await request.startDebug(type)
    if (!serverId) throw new Error(`was not able to start debug adapter ${type}`)

    return bridgeDebugAdapterServer(serverId)
  },
  debugWithType: async (folderUri: string, type: string): Promise<DebugStarterPack> => {
    const { launchConfig, serverId } = await request.startDebugWithType(folderUri, type)
    if (!serverId) throw new Error(`was not able to start debug adapter ${type}`)

    return { launchConfig, connection: bridgeDebugAdapterServer(serverId) }
  },
  debugWithConfig: async (folderUri: string, config: DebugConfiguration): Promise<DebugStarterPack> => {
    const { launchConfig, serverId } = await request.startDebugWithConfig(folderUri, config)
    if (!serverId) throw new Error(`was not able to start debug adapter ${config.type}`)

    return { launchConfig, connection: bridgeDebugAdapterServer(serverId) }
  },
}
