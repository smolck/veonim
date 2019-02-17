import * as configStore from '../extension-host/configuration-store'
import { objDeepGet } from '../support/utils'
import * as vsc from 'vscode'

export default (section?: string): vsc.WorkspaceConfiguration => {
  const config = configStore.getConfig()
  const possiblyObject = section ? objDeepGet(config)(section) : config
  const store = possiblyObject || {}

  const get = (section: string, defaultValue?: any) => {
    const result = objDeepGet(store)(section)
    return result || defaultValue
  }

  const has = (section: string) => {
    const result = objDeepGet(store)(section)
    return !!result
  }

  // TODO: i don't understand where to get defaultValue, globalValue,
  // workspaceValue, and workspaceFolderValue from...???
  const inspect = (section: string) => get(section)

  // TODO: support multiple levels of configuration (global, workspace, workspaceFolder, etc.)
  const update = (section: string, value: any) => {
    const next = section.split('.').reduceRight((res, part, ix) => {
      return Object.assign(res, { [part]: ix ? {} : value })
    }, {})
    Object.assign(store, next)
  }

  return new Proxy(Object.create(null), {
    get: (_: any, key: string) => {
      if (key === 'get') return get
      if (key === 'has') return has
      if (key === 'inspect') return inspect
      if (key === 'update') return update

      return Reflect.get(store, key)
    }
  })
}
