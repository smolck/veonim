import { shell, exists, watchFile } from '../support/utils'
import * as dispatch from '../messaging/dispatch'
import api from '../core/instance-api'
import * as path from 'path'

const watchers: { branch: any, status: any } = {
  branch: undefined,
  status: undefined,
}

const getStatus = async (cwd: string) => {
  const res = await shell(`git diff --numstat`, { cwd })
  const status = res
    .split('\n')
    .map(s => {
      const [ , additions, deletions ] = s.match(/^(\d+)\s+(\d+)\s+.*$/) || [] as any
      return {
        additions: parseInt(additions) || 0,
        deletions: parseInt(deletions) || 0,
      }
    })
    .reduce((total, item) => {
      total.additions += item.additions
      total.deletions += item.deletions
      return total
    }, { additions: 0, deletions: 0 })

  dispatch.pub('git:status', status)
}

const getBranch = async (cwd: string) => {
  const branch = await shell(`git rev-parse --abbrev-ref HEAD`, { cwd })
  dispatch.pub('git:branch', branch)
}

// TODO: BUFWRITE
console.warn('NYI: git status refresh on buffer write')
// nvim.on.bufWrite(() => getStatus(nvim.state.cwd))

api.nvim.watchState.cwd(async (cwd: string) => {
  getBranch(cwd)
  getStatus(cwd)

  if (watchers.branch) watchers.branch.close()
  if (watchers.status) watchers.status.close()

  const headPath = path.join(cwd, '.git/HEAD')
  const indexPath = path.join(cwd, '.git/index')

  if (await exists(headPath)) {
    watchers.branch = await watchFile(headPath, () => (getBranch(cwd), getStatus(cwd)))
  }
  if (await exists(indexPath)) {
    watchers.status = await watchFile(indexPath, () => getStatus(cwd))
  }
})
