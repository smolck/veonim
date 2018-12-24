import { onFnCall, proxyFn, uuid, CreateTask, fromJSON } from '../support/utils'
import { EventEmitter } from 'events'

type EventFn = { [index: string]: (...args: any[]) => void }
type RequestEventFn = { [index: string]: (...args: any[]) => Promise<any> }

const send = (data: any) => (postMessage as any)(data)
const internalEvents = new EventEmitter()
internalEvents.setMaxListeners(200)
const ee = new EventEmitter()
const pendingRequests = new Map()
let sharedArray = new Int32Array()

const readSharedArray = () => {
  const payloadLength = sharedArray[0]
  const payload = sharedArray.subarray(1, payloadLength + 1)
  const jsonString = Buffer.from(payload as any).toString()
  return fromJSON(jsonString).or({})
}

onmessage = async ({ data: [e, data = [], id] }: MessageEvent) => {
  if (e === '@@sab') {
    sharedArray = new Int32Array(data[0])
    return
  }

  if (!id) return ee.emit(e, ...data)

  if (pendingRequests.has(id)) {
    pendingRequests.get(id)(data)
    pendingRequests.delete(id)
    return
  }

  const listener = ee.listeners(e)[0]
  if (!listener) return
  const result = await listener(...data)
  send([e, result, id])
}

export const requestSync = onFnCall((event: string, args: any[]) => {
  send([event, args, 0, true])
  Atomics.wait(sharedArray, 0, 0)
  return readSharedArray()
})

export const workerData = (global as any).workerData
export const call: EventFn = onFnCall((event: string, args: any[]) => send([event, args]))
export const on = proxyFn((event: string, cb: (data: any) => void) => ee.on(event, cb))
export const request: RequestEventFn = onFnCall((event: string, args: any[]) => {
  const task = CreateTask()
  const id = uuid()
  pendingRequests.set(id, task.done)
  send([event, args, id])
  return task.promise
})
