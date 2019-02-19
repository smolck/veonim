import * as configStore from '../extension-host/configuration-store'
import * as vsc from 'vscode'

const getSection = (object: any, section: string) => {
  const matches = Object.entries(object).filter(([ key ]) => key.startsWith(section))
  return matches.reduce((res, [ key, value ]) => ({ ...res, [key]: value }), {})
}

export default (initialSection?: string): vsc.WorkspaceConfiguration => {
  const config = configStore.getConfig()
  const possiblyObject = initialSection ? getSection(config, initialSection) : config
  const store = possiblyObject || {}

  const get = (section: string, defaultValue?: any) => {
    const path = [ initialSection, section ].join('.')
    const result = getSection(store, path)
    return result || defaultValue
  }

  const has = (section: string) => {
    const path = [ initialSection, section ].join('.')
    const result = getSection(store, path)
    return !!result
  }

  // TODO: i don't understand where to get defaultValue, globalValue,
  // workspaceValue, and workspaceFolderValue from...???
  const inspect = (section: string) => get(section)

  // TODO: support multiple levels of configuration (global, workspace, workspaceFolder, etc.)
  const update = (section: string, value: any) => {
    const path = [ initialSection, section ].join('.')
    Reflect.set(store, section, value)
    configStore.update(path, value)
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
