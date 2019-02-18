import { fromJSON, readFile, writeFile, debounce } from '../support/utils'
import * as vsc from 'vscode'

export default (storagePath: string): vsc.Memento => {
  let cache: any
  const delayedWrite = debounce(() => writeFile(storagePath, JSON.stringify(cache)), 100)
  const populateCacheIfMissing = async () => {
    if (cache) return
    const data = await readFile(storagePath)
    cache = fromJSON(data).or({})
  }

  // it's possible that we will have undefined gets as the
  // initial cache gets populated from the filesystem
  const get = <T>(key: string, defaultValue?: T): T | undefined => {
    return Reflect.get(cache, key) || defaultValue
  }

  const update = async (key: string, value: any) => {
    await populateCacheIfMissing()
    Reflect.set(cache, key, value)
    delayedWrite()
  }

  populateCacheIfMissing()

  return { get, update }
}