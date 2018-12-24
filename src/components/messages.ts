import { NotifyKind, Notification } from '../protocols/veonim'
import { RowNormal } from '../components/row-container'
import { h, app, vimBlur, vimFocus } from '../ui/uikit'
import Input from '../components/text-input'
import { filter } from 'fuzzaldrin-plus'
import * as Icon from 'hyperapp-feather'
import api from '../core/instance-api'
import { colors } from '../ui/styles'

const state = {
  query: '',
  messages: [] as Notification[],
  cache: [] as Notification[],
  vis: false,
  ix: 0,
}

type S = typeof state

let elref: HTMLElement
const SCROLL_AMOUNT = 0.4

const iconStyle = { fontSize: '1.2rem' }

// TODO: maybe this can be shared with notifications.ts component
const icons = new Map([
  ['error', h(Icon.XCircle, { color: colors.error, style: iconStyle })],
  ['warning', h(Icon.AlertTriangle, { color: colors.warning, style: iconStyle })],
  ['success', h(Icon.CheckCircle, { color: colors.success, style: iconStyle })],
  ['info', h(Icon.MessageCircle, { color: colors.info, style: iconStyle })],
  ['hidden', h(Icon.MessageCircle, { color: colors.info, style: iconStyle })],
  ['system', h(Icon.AlertCircle, { color: colors.system, style: iconStyle })],
])

const getIcon = (kind: NotifyKind) => icons.get(kind) || icons.get('info')

const actions = {
  toggle: () => (s: S) => {
    const next = !s.vis
    next ? vimBlur() : vimFocus()
    return { vis: next }
  },

  hide: () => (vimFocus(), { vis: false }),

  addMessage: (message: Notification) => (s: S) => ({
    messages: [message, ...s.messages].slice(0, 500),
    cache: [message, ...s.messages].slice(0, 500),
  }),

  change: (query: string) => (s: S) => ({ query, ix: 0, messages: query
    ? filter(s.messages, query, { key: 'message' })
    : s.cache
  }),

  down: () => {
    const { height } = elref.getBoundingClientRect()
    elref.scrollTop += Math.floor(height * SCROLL_AMOUNT)
  },

  up: () => {
    const { height } = elref.getBoundingClientRect()
    elref.scrollTop -= Math.floor(height * SCROLL_AMOUNT)
  },
}

const view = ($: S, a: typeof actions) => h('div', {
  style: {
    background: 'var(--background-45)',
    color: '#eee',
    display: $.vis ? 'flex' : 'none',
    flexFlow: 'column',
    position: 'absolute',
    alignSelf: 'flex-end',
    maxHeight: '70vh',
    width: '100%',
  }
}, [

  ,Input({
    up: a.up,
    hide: a.hide,
    down: a.down,
    change: a.change,
    value: $.query,
    focus: true,
    small: true,
    icon: Icon.Filter,
    desc: 'filter messages',
  })

  ,h('div', {
    ref: (e: HTMLElement) => {
      if (e) elref = e
    },
    style: { overflowY: 'hidden' }
    // TODO: show timestamp and dedup. only dedup nearby?
  }, $.messages.map(({ id, kind, message }, pos) => h(RowNormal, {
    key: id,
    active: pos === $.ix
  }, [
    ,h('div', {
      display: 'flex',
      alignItems: 'center',
      paddingRight: '10px',
    }, [
      ,getIcon(kind)
    ])

    ,h('span', {
      style: {
        color: (icons.get(kind) || icons.get('info'))!.color
      }
    }, message)
  ])))

])

const ui = app({ name: 'messages', state, actions, view })

export const addMessage = (message: Notification) => ui.addMessage(message)

api.onAction('messages', ui.toggle)
