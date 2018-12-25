import { requestSyncWithContext } from '../messaging/worker-client'
import { NeovimAPI } from '../neovim/api'

export default <T>(fn: (nvim: NeovimAPI, ...args: any[]) => Promise<any>) => ({
  withArgs: (...args: any[]): T => requestSyncWithContext(fn.toString(), args),
})
