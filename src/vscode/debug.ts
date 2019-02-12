import { registerDebugConfigProvider } from '../extensions/debuggers'
import { Watcher } from '../support/utils'
import * as vsc from 'vscode'

interface Events {
  didChangeActiveDebugSession: vsc.DebugSession | undefined
  didStartDebugSession: vsc.DebugSession
  didReceiveDebugSessionCustomEvent: vsc.DebugSessionCustomEvent
  didTerminateDebugSession: vsc.DebugSession
  didChangeBreakpoints: vsc.BreakpointsChangeEvent
}

const events = Watcher<Events>()

const debug: typeof vsc.debug = {
  get activeDebugSession() {
    console.warn('NYI: debug.activeDebugSession')
    return undefined
  },
  get activeDebugConsole() {
    console.warn('NYI: debug.activeDebugConsole')
    return {
      append: (value: string) => console.log('vsc-ext-api.debugConsole', value),
      appendLine: (value: string) => console.log('vsc-ext-api.debugConsole', value),
    }
  },
  get breakpoints() {
    console.warn('NYI: debug.breakpoints')
    return []
  },
  registerDebugConfigurationProvider: (debugType: string, provider: vsc.DebugConfigurationProvider) => {
    const dispose = registerDebugConfigProvider(debugType, provider)
    // TODO: why fail to registerDebugConfigProvider? vscode api assumes this will always return a Disposable?
    return { dispose: dispose || (() => {}) }
  },
  registerDebugAdapterDescriptorFactory: () => {
    console.warn('NYI: debug.registerDebugAdapterDescriptorFactory')
    return { dispose: () => {} }
  },
  registerDebugAdapterTrackerFactory: () => {
    console.warn('NYI: debug.reigsterDebugAdapaterTrackerFactory')
    return { dispose: () => {} }
  },
  startDebugging: async () => {
    console.warn('NYI: debug.startDebugging')
    return false
  },
  addBreakpoints: () => {
    console.warn('NYI: debug.addBreakpoints')
  },
  removeBreakpoints: () => {
    console.warn('NYI: debug.removeBreakpoints')
  },
  onDidChangeActiveDebugSession: (fn, thisArg) => registerEvent('didChangeActiveDebugSession', fn, thisArg),
  onDidStartDebugSession: (fn, thisArg) => registerEvent('didStartDebugSession', fn, thisArg),
  onDidReceiveDebugSessionCustomEvent: (fn, thisArg) => registerEvent('didReceiveDebugSessionCustomEvent', fn, thisArg),
  onDidTerminateDebugSession: (fn, thisArg) => registerEvent('didTerminateDebugSession', fn, thisArg),
  onDidChangeBreakpoints: (fn, thisArg) => registerEvent('didChangeBreakpoints', fn, thisArg),
}

const registerEvent = (name: keyof Events, fn: any, thisArg?: any) => ({
  dispose: events.on(name, fn.bind(thisArg)),
})

export default debug
