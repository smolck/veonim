import { NotifyKind, Message } from '../protocols/veonim'
import { colors, badgeStyle } from '../ui/styles'
import { animate, cvar } from '../ui/css'
import * as Icon from 'hyperapp-feather'
import { h, app } from '../ui/uikit'

const state = {
  messages: [] as Message[],
}

type S = typeof state

const renderIcons = new Map([
  [ NotifyKind.Error, Icon.XCircle ],
  [ NotifyKind.Warning, Icon.AlertTriangle ],
  [ NotifyKind.Success, Icon.CheckCircle ],
  [ NotifyKind.Info, Icon.MessageCircle ],
  [ NotifyKind.System, Icon.AlertCircle ],
])

const getIcon = (kind: NotifyKind) => renderIcons.get(kind)!

const actions = {
  addMessage: (message: Message) => (s: S) => ({
    messages: [...s.messages, message],
  }),
}

type A = typeof actions

const Message = ({ kind, message }: Message) => h('div', {
  style: {
    display: 'flex',
    marginTop: '4px',
    padding: '18px',
    background: cvar('background-30'),
    borderLeft: '4px solid',
    borderColor: Reflect.get(colors, kind),
    fontSize: '1.2rem',
  }
}, [

  ,h('div', {
    style: {
      display: 'flex',
      wordBreak: 'break-all',
      alignItems: 'center',
    }
  }, [

    ,h('div', {
      style: {
        display: 'flex',
        paddingRight: '14px',
        alignItems: 'center',
        fontSize: '1.6rem',
        color: Reflect.get(colors, kind),
      }
    }, [
      ,h(getIcon(kind))
    ])

    ,h('span', {
      style: {
        color: cvar('foreground-10'),
      }
    }, message)

  ])
])

const view = ($: S, a: A) => h('div', {
  style: {
    display: 'flex',
    height: '100%',
    width: '100%',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  }
}, [

  ,h('div', {
    style: {
      display: 'flex',
      flexFlow: 'column',
    }
  }, [

    ,$.messages.map(Message)

  ])

])

const ui = app({ name: 'messages', state, actions, view })

ui.addMessage({ message: 'Would you like to download extensions?', kind: NotifyKind.Warning })
ui.addMessage({ message: 'Failed to download extension Rust', kind: NotifyKind.Error })
