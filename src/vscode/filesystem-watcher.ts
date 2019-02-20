import { Watcher } from '../support/utils'
import * as vsc from 'vscode'

interface Events {
  didCreate: vsc.Event<vsc.Uri>
  didChange: vsc.Event<vsc.Uri>
  didDelete: vsc.Event<vsc.Uri>
}

export default (pattern: vsc.GlobPattern, ignoreCreateEvents = false, ignoreChangeEvents = false, ignoreDeleteEvents = false): vsc.FileSystemWatcher => {
  const events = Watcher<Events>()
  const eventreg = (name: keyof Events) => (fn: any, thisArg?: any) => ({
    dispose: events.on(name, fn.bind(thisArg)),
  })

  // TODO: watch fs for pattern:
  console.warn('NYI: fileSystemWatcher - watch globPattern:', pattern)

  const onDidCreate = eventreg('didCreate')
  const onDidChange = eventreg('didChange')
  const onDidDelete = eventreg('didDelete')
  const dispose = () => {
      events.remove('didCreate')
      events.remove('didChange')
      events.remove('didDelete')
  }

  const api: vsc.FileSystemWatcher = {
    ignoreCreateEvents,
    ignoreChangeEvents,
    ignoreDeleteEvents,
    onDidCreate,
    onDidChange,
    onDidDelete,
    dispose,
  }

  return api
}
