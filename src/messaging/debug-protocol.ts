import { DebugProtocol as DP } from 'vscode-debugprotocol'
import { Readable, Writable } from 'stream'
import { ID, Watchers } from '../support/utils'

export interface DebugAdapterConnection {
  sendRequest: <T extends DP.Response>(
    command: string,
    args?: any
  ) => Promise<T['body']>
  sendNotification: (response: DP.Response) => void
  onNotification: <T extends DP.Event>(
    method: string,
    cb: (event: T['body']) => void
  ) => void
  onRequest: (cb: (request: DP.Request) => void) => void
  onError: (cb: (error: any) => void) => void
  onClose: (cb: () => void) => void
}

export default (
  readable: Readable,
  writable: Writable
): DebugAdapterConnection => {
  const pendingRequests = new Map()
  const watchers = new Watchers()
  const id = ID()

  let onErrorFn = (_: any) => {}
  let onRequestFn = (_: DP.Request) => {}
  let onCloseFn = () => {}

  readable.on('close', () => onCloseFn())
  writable.on('close', () => onCloseFn())

  const onMessage = (msg: DP.ProtocolMessage) => {
    if (msg.type === 'event')
      return watchers.notify((msg as DP.Event).event, (msg as DP.Event).body)
    if (msg.type === 'request') return onRequestFn(msg as DP.Request)
    if (msg.type === 'response') {
      const m = msg as DP.Response
      if (!pendingRequests.has(m.request_seq)) return

      const { done, fail } = pendingRequests.get(m.request_seq)
      m.success ? done(m.body) : fail(m)
      pendingRequests.delete(m.request_seq)
    }
  }

  const api = {} as DebugAdapterConnection

  api.sendNotification = (response) => {
    if (response.seq > 0)
      return onErrorFn(
        new Error(`don't send more than one response for: ${response.command}`)
      )
    const seq = id.next()
    connection.send({ seq, type: 'response', command: response.command })
  }

  api.sendRequest = (command, args = {}) => {
    const seq = id.next()
    connection.send({ command, seq, type: 'request', arguments: args })
    return new Promise((done, fail) => pendingRequests.set(seq, { done, fail }))
  }

  api.onNotification = (method, cb) => watchers.add(method, cb)
  api.onRequest = (cb) => (onRequestFn = cb)
  api.onError = (cb) => (onErrorFn = cb)
  api.onClose = (cb) => (onCloseFn = cb)

  const connection = streamProcessor(readable, writable, onMessage, onErrorFn)
  return api
}

const TWO_CRLF = '\r\n\r\n'
const HEADER_LINE_SEP = /\r?\n/
const HEADER_FIELD_SEP = /: */
const TWO_CRLF_LENGTH = TWO_CRLF.length

// stolen from: vscode/blob/master/src/vs/workbench/parts/debug/node/debugAdapter.ts
const streamProcessor = (
  readable: Readable,
  writable: Writable,
  onMessage: Function,
  onError: Function
) => {
  let rawData = Buffer.allocUnsafe(0)
  let contentLength = -1

  readable.on('data', (data: Buffer) => {
    // if (process.env.VEONIM_DEV) console.log('<<<', data+'')
    rawData = Buffer.concat([rawData, data])

    while (true) {
      if (contentLength >= 0) {
        if (rawData.length >= contentLength) {
          const message = rawData.toString('utf8', 0, contentLength)
          rawData = rawData.slice(contentLength)
          contentLength = -1

          if (message.length > 0) {
            try {
              const data: DP.ProtocolMessage = JSON.parse(message)
              onMessage(data)
            } catch (e) {
              const err = new Error(`${e.message || e}\n${message}`)
              onError(err)
            }
          }

          continue
        }
      } else {
        const idx = rawData.indexOf(TWO_CRLF)
        if (idx !== -1) {
          const header = rawData.toString('utf8', 0, idx)
          const lines = header.split(HEADER_LINE_SEP)

          for (const h of lines) {
            const kvPair = h.split(HEADER_FIELD_SEP)
            if (kvPair[0] === 'Content-Length')
              contentLength = Number(kvPair[1])
          }

          rawData = rawData.slice(idx + TWO_CRLF_LENGTH)

          continue
        }
      }

      break
    }
  })

  const send = <T extends DP.ProtocolMessage>(message: T) => {
    if (!writable) return
    const json = JSON.stringify(message)
    const length = Buffer.byteLength(json, 'utf8')
    writable.write(`Content-Length: ${length}${TWO_CRLF}${json}`, 'utf8')
  }

  return { send }
}
