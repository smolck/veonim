import { onExit, attachTo, switchTo, create } from '../core/master-control'
import { EventEmitter } from 'events'
import { remote } from 'electron'

interface Vim {
  id: number,
  name: string,
  active: boolean,
  path: string,
  nameFollowsCwd: boolean,
}

interface VimInfo {
  id: number
  path: string
}

const watchers = new EventEmitter()
watchers.setMaxListeners(200)
const vims = new Map<number, Vim>()
let currentVimID = -1

export default (id: number, path: string) => {
  vims.set(id, { id, path, name: 'main', active: true, nameFollowsCwd: true })
  const lastId = currentVimID
  currentVimID = id
  watchers.emit('create', { id, path })
  watchers.emit('switch', id, lastId)
}

export const createVim = async (name: string, dir?: string) => {
  const { id, path } = await create({ dir })
  const lastId = currentVimID
  currentVimID = id
  watchers.emit('create', { id, path })
  attachTo(id)
  switchTo(id)
  watchers.emit('switch', id, lastId)
  vims.forEach(v => v.active = false)
  vims.set(id, { id, path, name, active: true, nameFollowsCwd: !!dir })
}

export const switchVim = async (id: number) => {
  if (!vims.has(id)) return
  const lastId = currentVimID
  currentVimID = id
  switchTo(id)
  watchers.emit('switch', id, lastId)
  vims.forEach(v => v.active = false)
  vims.get(id)!.active = true
}

const renameVim = (id: number, newName: string) => {
  if (!vims.has(id)) return
  const vim = vims.get(id)!
  vim.name = newName
  vim.nameFollowsCwd = false
}

export const getCurrentName = () => {
  const active = [...vims.values()].find(v => v.active)
  return active ? active.name : ''
}

export const renameCurrent = (name: string) => {
  const active = [...vims.values()].find(v => v.active)
  if (!active) return
  renameVim(active.id, name)
}

export const renameCurrentToCwd = (cwd: string) => {
  const active = [...vims.values()].find(v => v.active)
  if (!active) return
  if (active.nameFollowsCwd) active.name = cwd
}

export const list = () => [...vims.values()].filter(v => !v.active).map(v => ({ id: v.id, name: v.name }))

export const instances = {
  get current() { return currentVimID }
}

export const onCreateVim = (fn: (info: VimInfo) => void) => {
  watchers.on('create', (info: VimInfo) => fn(info))
  ;[...vims.entries()].forEach(([ id, vim ]) => fn({ id, path: vim.path }))
}

export const onSwitchVim = (fn: (id: number, lastId: number) => void) => {
  watchers.on('switch', (id, lastId) => fn(id, lastId))
  fn(currentVimID, -1)
}

// because of circular dependency chain. master-control exports onExit.
// master-control imports a series of dependencies which eventually
// import this module. thus onExit will not be exported yet.
setImmediate(() => onExit((id: number) => {
  if (!vims.has(id)) return
  vims.delete(id)

  if (!vims.size) return remote.app.quit()

  const next = Math.max(...vims.keys())
  switchVim(next)
}))
