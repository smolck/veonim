import { NotifyKind, Message } from '../protocols/veonim'
import { animate, cvar } from '../ui/css'
import * as Icon from 'hyperapp-feather'
import { uuid } from '../support/utils'
import { colors } from '../ui/styles'
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
  removeMessage: (id: string) => (s: S) => ({
    messages: s.messages.filter(m => m.id !== id),
  }),
}

type A = typeof actions

const Message = ({ kind, message, actions = [{ label: 'OK', shortcut: 'C S N' }] }: Message) => h('div', {
  style: {
    display: 'flex',
    marginTop: '4px',
    padding: '16px 18px',
    background: cvar('background-30'),
    borderLeft: '4px solid',
    borderColor: Reflect.get(colors, kind),
    fontSize: '1.2rem',
    flexFlow: 'column',
  },
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

  ,h('div', {
    style: {
      marginTop: '10px',
      display: 'flex',
      justifyContent: 'flex-end',
    }
  }, actions.map(a => Action(a.label, a.shortcut)))

])

// TODO: create a highlight color from vim colorscheme
// const highlightColor = 'rgb(87, 52, 121)'
const highlightColor = 'rgb(78, 56, 100)'

const Action = (label: string, shortcut: string) => h('div', {
  style: {
    marginLeft: '10px',
  }
}, [

  ,h('div', {
    style: {
      display: 'flex',
    }
  }, [

    ,h('div', {
      style: {
        borderRadius: '2px',
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        padding: '5px 10px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: highlightColor,
        color: cvar('foreground'),
        border: 'none',
        clipPath: 'polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)',
        paddingRight: '20px',
        marginRight: '-12px',
        fontSize: '1rem',
      }
    }, label)

    ,h('div', {
      style: {
        clipPath: 'polygon(12px 0, 100% 0, 100% 100%, 0 100%)',
        color: cvar('foreground-20'),
        borderRadius: '2px',
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        background: 'none',
        padding: '5px 10px',
        border: '1px solid',
        borderColor: highlightColor,
        display: 'flex',
        borderLeft: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.86rem',
        fontWeight: 'bold',
        paddingLeft: '20px',
      }
    }, shortcut)

  ])

])

const view = ($: S) => h('div', {
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
      maxWidth: '500px',
    }
  }, [

    ,$.messages.map(Message)

  ])

])

const ui = app<S, A>({ name: 'messages', state, actions, view })

// TODO: i don't think vscode extensions specify a negative option
// i think it assumed that the x at the top right will close/dismiss
// the message. therefore i think we should hardcode the CSN (dismiss/reject)
// option and style it a bit differently

// TODO: in terms of where the buttons go, i'm thinking the oldest message
// (so the one at the bottom) will get the buttons (and keyboard action).
// once a keyboard action is activated, the message goes away and the next
// one will receive the buttons (again on the bottom)

ui.addMessage({
  id: 'fortytwo',
  message: 'Failed to download extension Rust',
  kind: NotifyKind.Error,
})

export const addMessage = (message: Message, onAction?: (action: string) => void) => {
  const id = uuid()
  ui.addMessage({ ...message, id })

  return () => ui.removeMessage(id)
}

const demo = () => {
  setTimeout(() => {
    const dispose = addMessage({
      message: 'Would you like to download extensions?',
      kind: NotifyKind.Warning,
      actions: [
        { label: 'Yes', shortcut: 'C S Y' },
        { label: 'No', shortcut: 'C S N' },
      ],
    })

    setTimeout(() => {
      dispose()
      demo()
    }, 3e3)
  }, 1e3)
}

demo()
