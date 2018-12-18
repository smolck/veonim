import { exists, readFile, configPath as base, watchFile } from '../support/utils'

type Config = Map<string, any>
type ConfigCallback = (config: Config) => void

const loadConfig = async (path: string, notify: ConfigCallback) => {
  const pathExists = await exists(path)
  if (!pathExists) return console.error(`config file at ${path} not found`)

  const data = await readFile(path)
  const config = data
    .toString()
    .split('\n')
    .filter((line: string) => /^let g:vn_/.test(line))
    .reduce((map: Config, line: string) => {
      const [ , key = '', dirtyVal = '' ] = line.match(/^let g:vn_(\S+)(?:\s*)\=(?:\s*)([\S\ ]+)/) || []
      const cleanVal = dirtyVal.replace(/^(?:"|')(.*)(?:"|')$/, '$1')
      map.set(key, cleanVal)
      return map
    }, new Map<string, any>())

  notify(config)
}

export default async (location: string, cb: ConfigCallback) => {
  const path = `${base}/${location}`
  const pathExists = await exists(path)
  if (!pathExists) return console.error(`config file at ${path} not found`)

  loadConfig(path, cb).catch(e => console.error(e))
  watchFile(path, () => loadConfig(path, cb).catch(e => console.error(e)))
}

export const watchConfig = async (location: string, cb: Function) => {
  const path = `${base}/${location}`
  const pathExists = await exists(path)
  if (!pathExists) return console.error(`config file at ${path} not found`)
  watchFile(path, () => cb())
}
