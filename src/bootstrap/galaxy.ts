// setup trace
;(localStorage.getItem('veonim-trace-flags') || '')
  .split(',')
  .filter(m => m)
  .forEach(m => Reflect.set(process.env, `VEONIM_TRACE_${m.toUpperCase()}`, 1))
// end setup trace

import { CreateTask, delay as timeout, requireDir } from '../support/utils'
import { resize, attachTo, create } from '../core/master-control'
import * as canvasContainer from '../core/canvas-container'
import configReader from '../config/config-reader'
import setDefaultSession from '../core/instance-manager'
import * as uiInput from '../core/input'
import nvim from '../core/neovim'
import '../ui/notifications'
import '../core/title'

const loadingConfig = CreateTask()

configReader('nvim/init.vim', c => {
  canvasContainer.setFont({
    face: c.get('font'),
    size: c.get('font_size')-0,
    lineHeight: c.get('line_height')-0
  })

  loadingConfig.done('')
})

nvim.watchState.background(color => {
  if (document.body.style.background !== color) document.body.style.background = color
})

canvasContainer.on('resize', ({ rows, cols }) => resize(cols, rows))

const main = async () => {
  const { id, path } = await create()
  await Promise.race([ loadingConfig.promise, timeout(500) ])
  resize(canvasContainer.size.cols, canvasContainer.size.rows)
  uiInput.focus()
  attachTo(id)
  setDefaultSession(id, path)

  setTimeout(() => {
    // TODO: can we load copmonents on demand?
    // aka, either load when user requests, or after 10 sec of app startup shit
    // in the inventory PR, layer actions are now setup to require the componet.
    // this could be a way to lazy load components (or maybe some of the
    // non-important ones - color-picker, etc.)
    requireDir(`${__dirname}/../services`)
    requireDir(`${__dirname}/../components`)
    setTimeout(() => require('../core/ai'))
  }, 1)

  // TODO: THIS SHOULD BE LOADED IN A WEB WORKER. WTF IS THIS SHIT DOING IN THE MAIN THREAD LOL
  // TODO: clearly we are not ready for this greatness
  setTimeout(() => require('../support/dependency-manager').default(), 100)
}

main().catch(console.error)

export const touched = () => {
  const start = document.getElementById('start')
  if (start) start.remove()
}
