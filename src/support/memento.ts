import { fromJSON, readFile, writeFile, debounce, exists } from '../support/utils'
import * as vsc from 'vscode'

export default async (storagePath: string): Promise<vsc.Memento> => {
  let cache: any
  const delayedWrite = debounce(() => writeFile(storagePath, JSON.stringify(cache)), 100)

  const populateCacheIfMissing = async () => {
    if (cache) return
    const dbExists = await exists(storagePath)
    if (!dbExists) return cache = {}
    const data = await readFile(storagePath)
    cache = fromJSON(data).or({})
  }

  const get = <T>(key: string, defaultValue?: T): T | undefined => {
    return Reflect.get(cache, key) || defaultValue
  }

  const update = async (key: string, value: any) => {
    await populateCacheIfMissing()
    Reflect.set(cache, key, value)
    delayedWrite()
  }

  await populateCacheIfMissing()
  return { get, update }
}
