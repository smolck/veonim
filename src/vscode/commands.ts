import { on } from '../messaging/worker-client'
import { EventEmitter } from 'events'
import * as vsc from 'vscode'

const registeredCommands = new EventEmitter()

const commands: typeof vsc.commands = {
  executeCommand: async (command: string, ...args: any[]) => {
    const [handler] = registeredCommands.listeners(command)
    if (!handler)
      return console.error(
        'commands.executeCommand failed because no registered command for:',
        command
      )
    return handler(...args)
  },
  getCommands: async (filterInternal?: boolean) => {
    const events = registeredCommands.eventNames().map((m) => m.toString())
    if (filterInternal) return events.filter((e) => !e.startsWith('_'))
    return events
  },
  registerCommand: (
    command: string,
    callback: (...args: any[]) => void,
    thisArg?: any
  ) => {
    registeredCommands.on(command, callback.bind(thisArg))
    return {
      dispose: () => registeredCommands.removeListener(command, callback),
    }
  },
  registerTextEditorCommand: (
    command: string,
    callback: Function,
    thisArg?: any
  ) => {
    // TODO: the callback needs to return a TextEditor object. where do we get that from?
    // TODO: are we supposed to return textEditorCommands in getCommands or executeCommand?
    console.warn(
      'NYI: registerTextEditorCommand',
      command,
      callback.bind(thisArg)
    )
    return {
      dispose: () => console.warn('NYI: registerTextEditorCommand disposable'),
    }
  },
}

export default commands

on.commands_execute((command: string, args: any[]) =>
  commands.executeCommand(command, ...args)
)
