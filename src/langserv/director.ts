import { Diagnostic, WorkspaceEdit } from 'vscode-languageserver-protocol'
import { registerServer } from '../langserv/server-features'
import toVSCodeLanguage from '../langserv/vsc-languages'
import defaultCapabs from '../langserv/capabilities'
import * as dispatch from '../messaging/dispatch'
import * as extensions from '../core/extensions'
import { applyEdit } from '../langserv/adapter'
import { Watchers } from '../support/utils'

interface ServKey {
  cwd: string,
  filetype: string,
}

enum CallKind {
  Request,
  Notification,
}

interface BufferedCall {
  kind: CallKind,
  method: string,
  params: any,
}

export enum SyncKind { None, Full, Incremental }

const servers = new Map<string, extensions.RPCServer>()
const serverStartCallbacks = new Set<Function>()
const startingServers = new Set<string>()
const bufferedServerCalls = new Map<string, BufferedCall[]>()
const watchers = new Watchers()

const processBufferedServerCalls = (key: string, server: extensions.RPCServer) => {
  const calls = bufferedServerCalls.get(key)
  if (!calls) return

  calls.forEach(({ kind, method, params }) => {
    if (kind === CallKind.Request) server.sendRequest(method, params)
    if (kind === CallKind.Notification) server.sendNotification(method, params)
  })

  bufferedServerCalls.delete(key)
}

const initServer = async (server: extensions.RPCServer, cwd: string, language: string) => {
  const { error, capabilities } = await server
    .sendRequest('initialize', defaultCapabs(cwd))
    .catch(console.error)

  if (error) throw new Error(`failed to initialize server ${cwd}:${language} -> ${JSON.stringify(error)}`)
  server.sendNotification('initialized', {})

  servers.set(cwd + language, server)
  registerServer(cwd, language, capabilities)
  processBufferedServerCalls(cwd + language, server)
  serverStartCallbacks.forEach(fn => fn(server, language))
}

const startServer = async (cwd: string, language: string, filetype: string) => {
  // yes, we check this status before calling this method, but it's async
  // so by the time we get here it will be wrong. there was an issue with
  // timing that was resolved by adding this check here.
  if (isServerStarting(cwd, language)) return
  startingServers.add(cwd + language)

  const server = await extensions.activate.language(language)
  await initServer(server, cwd, language)

  startingServers.delete(cwd + language)
  dispatch.pub('ai:start', { cwd, filetype })

  return server
}

// this line of checking starting servers means that any server calls made
// during the gap between server start and server ready are dropped. it seems
// weird/wrong, but after some thought i came to the conclusion that this
// behavior is acceptable.
//
// the reasoning is that from a users perspective, the outcome should be the
// same whether the server is not available or if it is starting. in each of
// these states the server is unavailable to respond to requests.
//
// so either the server will start quickly enough that very few or no requests
// will be "dropped" or the server will take such a long time to start, that
// buffering any requests will result in the UI being spammed with lots of
// outdated information likely at the wrong item (and a very poor UX)
//
// UPDATE: i realized the conclusion above only partially applies. in the case
// of user triggered actions, i think the reasoning still stands. however for
// system triggered actions, the above conclusion [about dropping calls] is
// wrong.  for example, we will have a few system actions such as synchronizing
// buffers didOpen, didChange which need to happen before any actions can be
// called on that buffer, and they must happen in a certain order. i observed
// that calling didChange without a didOpen breaks on some langservers.
//
// so i have made it conditional. all langserv calls can now opt-in to buffering
// until the server has started. this has been implemented for buffer sync events
const isServerStarting = (cwd: string, language: string) => startingServers.has(cwd + language)

const bufferCallUntilServerStart = async (call: BufferedCall) => {
  const { cwd, filetype } = call.params
  const language = toVSCodeLanguage(filetype)
  const serverAvailable = await extensions.existsForLanguage(language)
  if (!serverAvailable) return

  const key = cwd + language

  bufferedServerCalls.has(key)
    ? bufferedServerCalls.get(key)!.push(call)
    : bufferedServerCalls.set(key, [ call ])
}

const getServerForProjectAndLanguage = async ({ cwd, filetype }: ServKey) => {
  const language = toVSCodeLanguage(filetype)

  if (isServerStarting(cwd, language)) return
  if (servers.has(cwd + language)) return servers.get(cwd + language)

  const serverAvailable = await extensions.existsForLanguage(language)
  if (!serverAvailable) return

  return startServer(cwd, language, filetype)
}

export const filetypeDetectedStartServerMaybe = (cwd: string, filetype: string) => {
  getServerForProjectAndLanguage({ cwd, filetype })
}

export const request = async (method: string, params: any, { bufferCallIfServerStarting = false } = {}) => {
  if (!params.filetype) return
  const server = await getServerForProjectAndLanguage(params)
  if (server) return server.sendRequest(method, params)
  else bufferCallIfServerStarting && bufferCallUntilServerStart({ kind: CallKind.Request, method, params })
}

export const notify = async (method: string, params: any, { bufferCallIfServerStarting = false } = {}) => {
  if (!params.filetype) return
  const server = await getServerForProjectAndLanguage(params)
  if (server) server.sendNotification(method, params)
  else bufferCallIfServerStarting && bufferCallUntilServerStart({ kind: CallKind.Notification, method, params })
}

export const setTextSyncState = (pauseTextSync: boolean, params: ServKey) => {
  if (!params.filetype) return
  const language = toVSCodeLanguage(params.filetype)
  const server = servers.get(params.cwd + language)
  if (!server) return console.error('failed to setTextSyncState because langserver does not exist')

  server.setTextSyncState(pauseTextSync)
}

export const onServerStart = (fn: (server: extensions.RPCServer, language: string) => void) => {
  serverStartCallbacks.add(fn)
  return () => serverStartCallbacks.delete(fn)
}

export const onDiagnostics = (cb: (diagnostics: { uri: string, diagnostics: Diagnostic[] }) => void) => watchers.add('diagnostics', cb)

// TODO: on vimrc change load any new or updated extensions. provide user with manual extensions reload
extensions.load()

onServerStart(server => {
  server.onNotification(
    'textDocument/publishDiagnostics',
    diagnostics => watchers.notify('diagnostics', diagnostics),
  )
  server.onRequest(
    'workspace/applyEdit',
    async ({ edit }: { edit: WorkspaceEdit }) => applyEdit(edit),
  )
})
