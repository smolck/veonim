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
  }, 199)

  // TODO: user-menu and user-overlay-menu not calling user callbacks!

  //   ├── autocomplete.ts
  //   ├── code-actions.ts
  //   ├── hint.ts
  //   ├── hover.ts
  //   ├── problem-info.ts
  //   ├── problems.ts
  //   ├── references.ts
  //   ├── symbols.ts


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
