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

// TODO: user-menu and user-overlay-menu not calling user callbacks!
// TODO: check nvim services instances to make sure they are starting up correctly
// TODO: hide black canvas while webgl is init
// TODO: need to show where code actions are available

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

    require('../components/change-project')
    require('../components/vim-create')
    require('../components/vim-switch')
    require('../components/vim-rename')
    require('../components/buffers')
    require('../components/files')
    require('../components/explorer')
    require('../components/color-picker')
    require('../components/nc')
    require('../components/inventory')
    require('../components/divination')
    require('../components/debug')
    require('../components/generic-menu')
    require('../components/generic-prompt')
    require('../components/user-menu')
    require('../components/user-overlay-menu')
    require('../components/buffer-search')
    require('../components/viewport-search')
    require('../components/grep')

    // AI
    require('../components/autocomplete')
    require('../components/hint')
    require('../components/symbols')
    require('../components/references')
    require('../components/hover')
    require('../components/problem-info')
    require('../components/code-actions')
  }, 199)


  // requestAnimationFrame(() => {
  //   // TODO: can we load copmonents on demand?
  //   // aka, either load when user requests, or after 10 sec of app startup shit
  //   // in the inventory PR, layer actions are now setup to require the componet.
  //   // this could be a way to lazy load components (or maybe some of the
  //   // non-important ones - color-picker, etc.)
  //   requireDir(`${__dirname}/../components`)
  //   requestAnimationFrame(() => require('../core/ai'))
  //   setTimeout(() => require('../support/dependency-manager').default(), 100)
  // })
})
