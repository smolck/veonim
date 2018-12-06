import { PluginTop } from '../components/plugin-container'
import { merge, uuid, debounce } from '../support/utils'
import { addMessage } from '../components/messages'
import { colors, badgeStyle } from '../ui/styles'
import { animate, cvar } from '../ui/css'
import * as Icon from 'hyperapp-feather'
import { h, app } from '../ui/uikit'
import nvim from '../core/neovim'

export enum NotifyKind {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
  Success = 'success',
  System = 'system',
  Hidden = 'hidden',
}

interface FlexibleExpire {
  refresh(): void
}

export interface Notification {
  id: string,
  kind: NotifyKind,
  message: string,
  count: number,
  expire?: FlexibleExpire,
  time: number,
}

const state = {
  notifications: [] as Notification[],
}

type S = typeof state

const expire = (time: number, cb: Function): FlexibleExpire => {
  const refresh = debounce(cb, time)
  return (refresh(), { refresh })
}

const container = document.getElementById('notifications') as HTMLElement
merge(container.style, { zIndex: 80 })

const renderIcons = new Map([
  [ NotifyKind.Error, Icon.XCircle ],
  [ NotifyKind.Warning, Icon.AlertTriangle ],
  [ NotifyKind.Success, Icon.CheckCircle ],
  [ NotifyKind.Info, Icon.MessageCircle ],
  [ NotifyKind.System, Icon.AlertCircle ],
])

const getIcon = (kind: NotifyKind) => renderIcons.get(kind)!

const actions = {
  clear: () => ({ notifications: [] }),
  notify: (notification: Notification) => (s: S) => {
    if (notification.kind === NotifyKind.Hidden) return

    const existingIndex = s.notifications.findIndex(n => n.message === notification.message)

    if (existingIndex > -1) {
      const ns = s.notifications.slice()
      ns[existingIndex].count += 1
      ns[existingIndex].expire!.refresh()
      return { notifications: ns }
    }

    const time = notification.kind === NotifyKind.Info ? 1200 : 3e3
    notification.expire = expire(time, () => ui.expire(notification.id))
    return { notifications: [...s.notifications, notification] }
  },

  expire: (id: string) => (s: S) => ({ notifications: s.notifications.filter(m => m.id !== id) }),
}

const view = ($: S) => PluginTop(true, {
  position: 'absolute',
  background: 'none',
  marginTop: '5px',
}, [

  ,h('div', $.notifications.map(({ kind, message, count }) => h('div', {
      style: {
        display: 'flex',
        padding: '10px',
        marginBottom: '6px',
        justifyContent: 'space-between',
        background: cvar('background-50'),
        color: Reflect.get(colors, kind),
      },
      oncreate: (e: HTMLElement) => animate(e, [
        { opacity: 0, transform: 'translateY(-100%) '},
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 150 }),
      onremove: async (e: HTMLElement, done: Function) => {
        await animate(e, [
          { opacity: 1 },
          { opacity: 0 },
        ], { duration: 150 })

        done()
      },
    }, [

      ,h('div', {
        style: {
          display: 'flex',
          wordBreak: 'break-all',
        }
      }, [
        ,h('div', {
          style: {
            display: 'flex',
            paddingRight: '8px',
            alignItems: 'center',
          }
        }, [
          ,h(getIcon(kind))
        ])

        ,h('span', message)
      ])

      ,count > 1 && h('div', {
        style: {
          ...badgeStyle,
          alignSelf: 'flex-end',
        },
      }, [
        ,h('span', count)
      ])

    ]))

  )

])

const ui = app<S, typeof actions>({ name: 'notifications', element: container, state, actions, view })

export const notify = (message: string, kind = NotifyKind.Info) => {
  const msg = {
    kind,
    message,
    time: Date.now(),
    id: uuid(),
    count: 1,
  }

  ui.notify(msg)
  addMessage(msg)

  if (process.env.VEONIM_DEV) {
    if (kind === NotifyKind.Error) console.error('@VIM@', msg.message)
    if (kind === NotifyKind.Warning) console.error('@VIM@', msg.message)
    else console.log('@VIM@', msg.message)
  }
}

export const clear = () => ui.clear()
nvim.onAction('messages-clear', clear)
