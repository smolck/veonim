// setup trace
;(localStorage.getItem('veonim-trace-flags') || '')
  .split(',')
  .filter(m => m)
  .forEach(m => Reflect.set(process.env, `VEONIM_TRACE_${m.toUpperCase()}`, 1))
// end setup trace

import * as instanceManager from '../core/instance-manager'
import { resize } from '../core/master-control'
import * as workspace from '../core/workspace'
import { requireDir } from '../support/utils'
import '../render/redraw'

// TODO: user-menu and user-overlay-menu not calling user callbacks!
// TODO: check nvim services instances to make sure they are starting up correctly
// TODO: hide black canvas while webgl is init
// TODO: need to show where code actions are available
// TODO: webgl line width

workspace.on('resize', ({ rows, cols }) => resize(cols, rows))
workspace.resize()

requestAnimationFrame(() => {
  instanceManager.createVim('main')

  // high priority components
  requestAnimationFrame(() => {
    require('../components/statusline')
    require('../components/command-line')
    require('../components/vim-search')
  })

  // TODO: use requireDir once we can load all components safely
  setTimeout(() => {
    require('../services/remote')
    requireDir(`${__dirname}/../components`)
    //   TODO: load dependency-manager from a worker
    //   setTimeout(() => require('../support/dependency-manager').default(), 100)
  }, 199)
})
