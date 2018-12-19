import { DiagnosticSeverity } from 'vscode-languageserver-protocol'
import { RowHeader, RowDesc } from '../components/row-container'
import { PluginBottom } from '../components/plugin-container'
import * as canvasContainer from '../core/workspace'
import { h, app, vimBlur, vimFocus } from '../ui/uikit'
import { badgeStyle, colors } from '../ui/styles'
import { simplifyPath } from '../support/utils'
import { showCursorline } from '../core/cursor'
import Input from '../components/text-input'
import { Problem } from '../ai/diagnostics'
import * as Icon from 'hyperapp-feather'
import { filter } from 'fuzzaldrin-plus'
import { clipboard } from 'electron'
import nvim from '../neovim/api'
import { join } from 'path'

let elref: HTMLElement
const SCROLL_AMOUNT = 0.4
const els = new Map<number, HTMLElement>()

// scroll after next section has been rendered as expanded (a little hacky)
const scrollIntoView = (next: number) => setTimeout(() => {
  const { top: containerTop, bottom: containerBottom } = elref.getBoundingClientRect()
  const e = els.get(next)
  if (!e) return

  const { top, height } = e.getBoundingClientRect()

  if (top + height > containerBottom) {
    const offset = top - containerBottom

    if (offset < containerTop) elref.scrollTop += top - containerTop
    else elref.scrollTop += offset + height + containerTop + 50
  }

  else if (top < containerTop) elref.scrollTop += top - containerTop
}, 1)

const selectResult = (results: Problem[], ix: number, subix: number) => {
  if (subix < 0) return
  const group: Problem = Reflect.get(results, ix)
  if (!group) return
  const { file, dir, items } = group
  const { range: { start: { line, character } } } = items[subix]

  const path = join(dir, file)
  nvim.jumpToProjectFile({ path, line, column: character })
  showCursorline()
}

const state = {
  focus: false,
  val: '',
  problems: [] as Problem[],
  cache: [] as Problem[],
  vis: false,
  ix: 0,
  subix: 0,
}

type S = typeof state

const iconStyle = {
  paddingRight: '10px',
  fontSize: '1.2rem',
}

const icons = {
  [DiagnosticSeverity.Error]: h(Icon.XCircle, {
    color: colors.error,
    style: iconStyle,
  }),
  [DiagnosticSeverity.Warning]: h(Icon.XCircle, {
    color: colors.warning,
    style: iconStyle,
  })
}

const getSeverityIcon = (severity = 1) => Reflect.get(icons, severity)

const position: { container: ClientRect } = {
  container: { left: 0, right: 0, bottom: 0, top: 0, height: 0, width: 0 }
}

const actions = {
  toggle: () => (s: S) => ({ vis: !s.vis }),
  hide: () => (vimFocus(), { focus: false }),
  focus: () => (vimBlur(), { focus: true, vis: true }),
  yank: (s: S) => clipboard.writeText(s.val),

  updateProblems: (problems: Problem[]) => ({
    ix: 0,
    subix: -1,
    problems,
    cache: problems,
  }),

  change: (val: string) => (s: S) => ({ val, ix: 0, problems: val
    ? filter(s.problems, val, { key: 'file' })
    : s.cache
  }),

  nextGroup: () => (s: S) => {
    const next = s.ix + 1 > s.problems.length - 1 ? 0 : s.ix + 1
    scrollIntoView(next)
    return { subix: -1, ix: next }
  },

  prevGroup: () => (s: S) => {
    const next = s.ix - 1 < 0 ? s.problems.length - 1 : s.ix - 1
    scrollIntoView(next)
    return { subix: -1, ix: next }
  },

  next: () => (s: S) => {
    const items = (Reflect.get(s.problems, s.ix) || {}).items || []
    const next = s.subix + 1 < items.length ? s.subix + 1 : 0
    selectResult(s.problems, s.ix, next)
    return { subix: next }
  },

  prev: () => (s: S) => {
    const items = (Reflect.get(s.problems, s.ix) || {}).items || []
    const prev = s.subix - 1 < 0 ? items.length - 1 : s.subix - 1
    selectResult(s.problems, s.ix, prev)
    return { subix: prev }
  },

  down: () => {
    const { height } = elref.getBoundingClientRect()
    elref.scrollTop += Math.floor(height * SCROLL_AMOUNT)
  },

  up: () => {
    const { height } = elref.getBoundingClientRect()
    elref.scrollTop -= Math.floor(height * SCROLL_AMOUNT)
  },
}

type A = typeof actions

const view = ($: S, a: A) => PluginBottom($.vis, {
  maxHeight: '30vh',
}, [

  ,Input({
    up: a.up,
    hide: a.hide,
    next: a.next,
    prev: a.prev,
    down: a.down,
    change: a.change,
    nextGroup: a.nextGroup,
    prevGroup: a.prevGroup,
    value: $.val,
    focus: $.focus,
    small: true,
    icon: Icon.Filter,
    desc: 'filter by files',
  })

  ,h('div', {
    oncreate: (e: HTMLElement) => elref = e,
    style: {
      display: 'flex',
      flexFlow: 'column',
      overflow: 'hidden',
    }
  }, $.problems.map(({ file, dir, items }, pos) => h('div', {
    oncreate: (e: HTMLElement) => els.set(pos, e),
  }, [

    ,h(RowHeader, {
      active: pos === $.ix,
    }, [
      ,h('span', file),
      ,h('span', {
        style: {
          color: '#aaa',
          marginLeft: '10px',
          marginRight: '10px',
          fontSize: `${canvasContainer.font.size} - 2px`,
        }
      }, simplifyPath(dir, nvim.state.cwd)),

      ,h('div', {
        style: badgeStyle,
      }, [
        ,h('span', items.length)
      ])
    ])

    ,pos === $.ix && h('div', items.map(({ severity, message, range }, itemPos) => h(RowDesc, {
      active: itemPos === $.subix,
      oncreate: (e: HTMLElement) => {
        if (itemPos !== $.subix) return
        const { top, bottom } = e.getBoundingClientRect()
        if (top < position.container.top) return e.scrollIntoView(true)
        if (bottom > position.container.bottom) return e.scrollIntoView(false)
      },
    }, [
      ,h('div', {
        display: 'flex',
        alignItems: 'center',
        paddingRight: '10px',
      }, [
        ,getSeverityIcon(severity)
      ])

      ,h('div', {
        style: {
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
          whiteSpace: 'normal',
        }
      }, `${message}  (${range.start.line + 1}, ${range.start.character + 1})`)
    ])))

  ])))

])

const ui = app({ name: 'problems', state, actions, view })

export const hide = () => ui.hide()
export const focus = () => ui.focus()
export const toggle = () => ui.toggle()
export const update = (problems: Problem[]) => ui.updateProblems(problems)
