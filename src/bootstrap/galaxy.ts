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

// TODO: load dependency manager (in a thread)
// TODO: rewrite dependency manager to extract plugins/extensions from vimscript
// TODO: only remove extensions installed by veonim (track them in localStorage?)
// TODO: user-menu and user-overlay-menu not calling user callbacks!
// TODO: check nvim services instances to make sure they are starting up correctly
// TODO: hide black canvas while webgl is init
// TODO: need to show where code actions are available
// TODO: webgl line width
// TODO: investigate no texture on unit0. im guessing the texture atlas are not
// ready on load?
// TODO: do we still need roboto-sizes.json? we generate the font atlas before
// we can wrender anything to webgl, so we can probably grab the size then

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

  setTimeout(() => {
    require('../services/remote')
    requireDir(`${__dirname}/../components`)
    //   TODO: load dependency-manager from a worker
    //   setTimeout(() => require('../support/dependency-manager').default(), 100)
  }, 199)
})
