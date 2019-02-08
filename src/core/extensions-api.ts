import { DebugAdapterConnection } from '../messaging/debug-protocol'
import { Providers } from '../extension-host/providers'
import { traceLANGSERV as log } from '../support/trace'
import { workerData } from '../messaging/worker-client'
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

export interface RPCServer {
  setTextSyncState: (pauseTextSync: boolean) => void
  sendNotification: (method: string, ...params: any[]) => void
  sendRequest: (method: string, ...params: any[]) => Promise<any>
  onNotification: (method: string, cb: (...args: any[]) => void) => void
  onRequest: (method: string, cb: (...args: any[]) => Promise<any>) => void
  onError: (cb: (err: any) => void) => void
  onClose: (cb: (err: any) => void) => void
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
      promise: request.provider(method, args, id),
    }
  }
})

export const vscode = {
  language: providerBridge,
}

const bridgeServer = (serverId: string): RPCServer => {
  const api = {} as RPCServer

  api.sendNotification = (method, ...params) => {
    call.server_sendNotification({ serverId, method, params })
    log('NOTIFY -->', method, ...params)
  }

  api.sendRequest = async (method, ...params) => {
    log('REQUEST -->', method, ...params)
    const res = await request.server_sendRequest({ serverId, method, params })
    log('<-- REQUEST', method, res)
    return res
  }

  api.onNotification = (method, cb) => {
    call.server_onNotification({ serverId, method })
    on[`${serverId}:${method}`]((args: any[]) => {
      cb(...args)
      log('<-- NOTIFY', method, args)
    })
  }

  api.onRequest = (method, cb) => {
    call.server_onRequest({ serverId, method })
    on[`${serverId}:${method}`]((args: any[]) => cb(...args))
  }

  api.onError = cb => {
    call.server_onError({ serverId })
    on[`${serverId}:onError`]((err: any) => cb(err))
  }

  api.onClose = cb => {
    call.server_onExit({ serverId })
    on[`${serverId}:onClose`]((err: any) => cb(err))
  }

  api.setTextSyncState = pauseTextSync => call.server_setTextSyncState(serverId, pauseTextSync)

  return api
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
export const existsForLanguage = (language: string) => request.existsForLanguage(language)
export const listDebuggers = () => request.listDebuggers()

export const activate = {
  language: async (language: string): Promise<RPCServer> => {
    const serverId = await request.activate({ kind: 'language', data: language })
    if (!serverId) throw new Error(`was not able to start language server for ${language}`)
    return bridgeServer(serverId)
  }
}

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
