import api from '../core/instance-api'
import { h, app } from '../ui/uikit'

// TODO: show some layers as disabled? like the langserv layer would be disabled if there
// are not language servers started. user can still see options and info, but visually
// it appears non-functional
//
// can provide in layer description that 'this layer requires language server available'
// the provide current status of lang serv. provide links to where to install langextensions

const state = {
  visible: false,
}

type S = typeof state

const resetState = { visible: false }

const actions = {
  show: () => ({ visible: true }),
  hide: () => resetState,
}

type A = typeof actions

const view = ($: S) => h('div', {
  style: {
    display: $.visible ? 'flex' : 'none',
  },
}, [
  ,h('div', 'ur inventory got ninja looted luls')
])

const ui = app<S, A>({ name: 'inventory', state, view, actions })

api.onAction('inventory', async () => {
  // TODO: do we need timeoutLength? i wonder if we should just roll our own thing
  // const timeoutLength = await nvim.options.timeoutlen
  // console.log('timeoutLength', timeoutLength)
  ui.show()
})
