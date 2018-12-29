import { stealInput, registerShortcut } from '../core/input'
import { NotifyKind } from '../protocols/veonim'
import { record, replay } from '../dev/recorder'
import { notify } from '../ui/notifications'
import { VimMode } from '../neovim/types'
import { h, app } from '../ui/uikit'

const actions = new Map()

actions.set('v', {
  desc: 'run VSCODE api tests',
  fn: () => fetch('http://localhost:22444/test/vscode'),
})

actions.set('s', {
  desc: 'record all keyboard inputs for playback',
  fn: () => setImmediate(record),
})

actions.set('r', {
  desc: 'replay last input recording',
  fn: () => setImmediate(replay),
})

const KeyVal = (key: string, val: string) => h('div', {
  style: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '5px',
    marginBottom: '5px',
  }
}, [
  ,h('span', {
    style: {
      fontSize: '2rem',
      fontWeight: 'bold',
      marginRight: '15px',
    },
  }, key.toUpperCase())

  ,h('span', val)
])

const container = document.createElement('div')
container.setAttribute('id', 'dev-menu')
const bigChungus = [...actions.entries()].map(([ key, { desc } ]) => KeyVal(key, desc))
const view = () => h('div', {
  style: {
    position: 'absolute',
    zIndex: 600,
    padding: '20px',
    top: '80px',
    left: '40px',
    background: '#000',
  }
}, bigChungus)
app({ name: 'dev-menu', state: {}, actions: {}, view, element: container })

registerShortcut('S-C-k', VimMode.Normal, () => {
  document.body.appendChild(container)

  const restoreInput = stealInput(key => {
    const action = actions.get(key)
    if (action) {
      notify(`running: ${action.desc}`, NotifyKind.System)
      action.fn()
    }
    restoreInput()
    container.remove()
  })
})
