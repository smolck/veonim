import { onFnCall, proxyFn, Watchers, uuid, CreateTask } from '../support/utils'
import { EventEmitter } from 'events'

type EventFn = { [index: string]: (...args: any[]) => void }
type RequestEventFn = { [index: string]: (...args: any[]) => Promise<any> }

// your linter may complain that postMessage has the wrong number of args. this
// is probably because the linter does not understand that we are in a web
// worker context.  (assumes we are in the main web thread). i tried to make
// this work with the tsconfigs, but alas: i am not clever enough
const send = (data: any) => (postMessage as any)(data)

const internalEvents = new EventEmitter()
internalEvents.setMaxListeners(200)
const watchers = new Watchers()
const pendingRequests = new Map()

onmessage = ({ data: [e, data = [], id] }: MessageEvent) => {
  if (!id) return watchers.notify(e, ...data)

  if (pendingRequests.has(id)) {
    pendingRequests.get(id)(data)
    pendingRequests.delete(id)
    return
  }

  watchers.notifyFn(e, cb => {
    const resultOrPromise = cb(...data)
    if (!resultOrPromise) return
    if (resultOrPromise.then) resultOrPromise.then((res: any) => send([e, res, id]))
    else send([e, resultOrPromise, id])
  })
}

export const call: EventFn = onFnCall((event: string, args: any[]) => send([event, args]))
export const on = proxyFn((event: string, cb: (data: any) => void) => watchers.add(event, cb))
export const request: RequestEventFn = onFnCall((event: string, args: any[]) => {
  const task = CreateTask()
  const id = uuid()
  pendingRequests.set(id, task.done)
  send([event, args, id])
  return task.promise
})
