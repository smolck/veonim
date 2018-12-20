// setup trace
;(localStorage.getItem('veonim-trace-flags') || '')
  .split(',')
  .filter(m => m)
  .forEach(m => Reflect.set(process.env, `VEONIM_TRACE_${m.toUpperCase()}`, 1))
// end setup trace

import * as instanceManager from '../core/instance-manager'
import { resize } from '../core/master-control'
import * as workspace from '../core/workspace'
// import { requireDir } from '../support/utils'
import '../render/redraw'

workspace.on('resize', ({ rows, cols }) => resize(cols, rows))

requestAnimationFrame(() => {
  // TODO: rename to cwd
  instanceManager.createVim('main')
  resize(workspace.size.cols, workspace.size.rows)

  setTimeout(() => {
    require('../components/statusline')
    require('../components/change-project')
    require('../components/command-line')
  }, 199)

  // requestAnimationFrame(() => {
  //   // TODO: can we load copmonents on demand?
  //   // aka, either load when user requests, or after 10 sec of app startup shit
  //   // in the inventory PR, layer actions are now setup to require the componet.
  //   // this could be a way to lazy load components (or maybe some of the
  //   // non-important ones - color-picker, etc.)
  //   requireDir(`${__dirname}/../services`)
  //   requireDir(`${__dirname}/../components`)
  //   requestAnimationFrame(() => require('../core/ai'))
  //   setTimeout(() => require('../support/dependency-manager').default(), 100)
  // })
})
