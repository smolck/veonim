import { RowNormal } from '../components/row-container'
import { h, app, vimBlur, vimFocus } from '../ui/uikit'
import * as windows from '../windows/window-manager'
import Input from '../components/text-input'
import Overlay from '../components/overlay'
import { filter } from 'fuzzaldrin-plus'
import * as Icon from 'hyperapp-feather'
import api from '../core/instance-api'
import { CodeAction } from 'vscode'

const state = {
  x: 0,
  y: 0,
  value: '',
  visible: false,
  actions: [] as CodeAction[],
  cache: [] as CodeAction[],
  index: 0,
}

type S = typeof state

const resetState = { value: '', visible: false }

const actions = {
  show: ({ x, y, actions }: any) => (
    vimBlur(), { x, y, actions, cache: actions, visible: true }
  ),
  hide: () => (vimFocus(), resetState),

  change: (value: string) => (s: S) => ({
    value,
    index: 0,
    actions: value ? filter(s.actions, value, { key: 'title' }) : s.cache,
  }),

  select: () => (s: S) => {
    vimFocus()
    if (!s.actions.length) return resetState
    const action = s.actions[s.index]
    if (action) api.ai.codeAction.run(action)
    return resetState
  },

  next: () => (s: S) => ({
    index: s.index + 1 > s.actions.length - 1 ? 0 : s.index + 1,
  }),
  prev: () => (s: S) => ({
    index: s.index - 1 < 0 ? s.actions.length - 1 : s.index - 1,
  }),
}

const view = ($: S, a: typeof actions) =>
  Overlay(
    {
      x: $.x,
      y: $.y,
      zIndex: 100,
      maxWidth: 600,
      visible: $.visible,
      anchorAbove: false,
    },
    [
      ,
      h(
        'div',
        {
          style: {
            background: 'var(--background-40)',
          },
        },
        [
          ,
          Input({
            hide: a.hide,
            next: a.next,
            prev: a.prev,
            change: a.change,
            select: a.select,
            value: $.value,
            focus: true,
            small: true,
            icon: Icon.Code,
            desc: 'run code action',
          }),

          h(
            'div',
            $.actions.map((s, ix) =>
              h(
                RowNormal,
                {
                  key: s.title,
                  active: ix === $.index,
                },
                [, h('span', s.title)]
              )
            )
          ),
        ]
      ),
    ]
  )

const ui = app({ name: 'code-actions', state, actions, view })

api.ai.codeAction.onShow((row: number, col: number, actions: CodeAction[]) => {
  if (!actions.length) return
  const { x, y } = windows.pixelPosition(row + 1, col)
  ui.show({ x, y, actions })
})
