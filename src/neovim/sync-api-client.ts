import { requestSyncWithContext } from '../messaging/worker-client'
import { NeovimAPI } from '../neovim/api'

type UnPromisify<T> = T extends Promise<infer U> ? U : T;

export default <T>(fn: (nvim: NeovimAPI, ...args: any[]) => T) => ({
  withArgs: (...args: any[]): UnPromisify<T> => requestSyncWithContext(fn.toString(), args),
})
