import { onFnCall, proxyFn, Watchers, uuid, CreateTask } from '../support/utils'
import { EV_CREATE_VIM, EV_SWITCH_VIM } from '../support/constants'
import { onCreateVim, onSwitchVim } from '../core/instance-manager'

type EventFn = { [index: string]: (...args: any[]) => void }
type RequestEventFn = { [index: string]: (...args: any[]) => Promise<any> }

export default (name: string, debugName?: string) => {
  // @ts-ignore
  const worker = new Worker(`${__dirname}/../workers/${name}.js`, { name: debugName })
  const watchers = new Watchers()
  const pendingRequests = new Map()

  const call: EventFn = onFnCall((event: string, args: any[]) => worker.postMessage([event, args]))
  const on = proxyFn((event: string, cb: (data: any) => void) => watchers.add(event, cb))
  const request: RequestEventFn = onFnCall((event: string, args: any[]) => {
    const task = CreateTask()
    const id = uuid()
    pendingRequests.set(id, task.done)
    worker.postMessage([event, args, id])
    return task.promise
  })

  worker.onmessage = ({ data: [e, data = [], id] }: MessageEvent) => {
    if (!id) return watchers.notify(e, ...data)

    if (pendingRequests.has(id)) {
      pendingRequests.get(id)(data)
      pendingRequests.delete(id)
      return
    }

    watchers.notifyFn(e, cb => {
      const resultOrPromise = cb(...data)
      if (!resultOrPromise) return
      if (resultOrPromise.then) resultOrPromise.then((res: any) => worker.postMessage([e, res, id]))
      else worker.postMessage([e, resultOrPromise, id])
    })
  }

  onCreateVim(m => call[EV_CREATE_VIM](m))
  onSwitchVim(m => call[EV_SWITCH_VIM](m))

  return { on, call, request }
}
