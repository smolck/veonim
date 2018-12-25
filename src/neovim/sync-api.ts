import nvim from '../neovim/api'
import { Script } from 'vm'

export default (func: string, args: any[]) => {
  const theFunctionToRun = new Script(func).runInThisContext()
  return theFunctionToRun(nvim, ...args)
}
