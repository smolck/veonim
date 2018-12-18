import { exists, watchFile } from '../support/utils'
import { onSwitchVim } from '../core/instance-manager'
import nvim from '../core/neovim'
import { join } from 'path'

const sessions = new Map<number, Set<string>>()
const watchers = new Map<string, any>()
let currentSession = new Set<string>()

const anySessionsHaveFile = (file: string) => [...sessions.values()].some(s => s.has(file))

onSwitchVim(id => {
  if (sessions.has(id)) currentSession = sessions.get(id)!
  else sessions.set(id, currentSession = new Set<string>())
  nvim.cmd(`checktime`)
})

nvim.on.bufLoad(async () => {
  const filepath = join(nvim.state.cwd, nvim.state.file)
  if (!filepath) return
  if (!await exists(filepath)) return
  currentSession.add(filepath)
  const w = await watchFile(filepath, () => currentSession.has(filepath) && nvim.cmd(`checktime ${filepath}`))
  watchers.set(filepath, w)
})

nvim.on.bufClose(() => {
  const filepath = join(nvim.state.cwd, nvim.state.file)
  if (!filepath) return
  currentSession.delete(filepath)
  if (anySessionsHaveFile(filepath)) return
  watchers.has(filepath) && watchers.get(filepath)!.close()
})

