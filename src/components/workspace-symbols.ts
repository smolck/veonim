import { getSymbolIcon, getSymbolDescription } from '../components/symbol-info'
import { Plugin } from '../components/plugin-container'
import { RowNormal } from '../components/row-container'
import { h, app, vimBlur, vimFocus } from '../ui/uikit'
import { WorkspaceSymbol } from '../ai/protocol'
import Input from '../components/text-input'
import { filter } from 'fuzzaldrin-plus'
import * as Icon from 'hyperapp-feather'
import api from '../core/instance-api'

const state = {
  loading: false,
  value: '',
  symbols: [] as WorkspaceSymbol[],
  cache: [] as WorkspaceSymbol[],
  visible: false,
  index: 0,
}

type S = typeof state

const pos: { container: ClientRect } = {
  container: { left: 0, right: 0, bottom: 0, top: 0, height: 0, width: 0 }
}

const symbolCache = (() => {
  let cache: WorkspaceSymbol[] = []

  const clear = () => cache = []
  const find = (query: string) => filter(cache, query, { key: 'name' })

  const update = (symbols: WorkspaceSymbol[]) => {
    symbols.forEach(s => {
      const alreadyHas = cache.some(m => m.name === s.name)
      if (!alreadyHas) cache.push(s)
    })
  }

  return { update, find, clear }
})()

const resetState = { value: '', visible: false, index: 0, loading: false }

const actions = {
  select: () => (s: S) => {
    vimFocus()
    if (!s.symbols.length) return (symbolCache.clear(), resetState)
    const { path, range: { start } } = s.symbols[s.index]
    api.nvim.jumpTo({
      path,
      line: start.line,
      column: start.character,
    })
    return (symbolCache.clear(), resetState)
  },

  change: (value: string) => (_: S, a: A) => {
    api.ai.workspaceSymbols.getSymbols(value).then(symbols => {
      symbolCache.update(symbols)
      const results = symbols.length ? symbols : symbolCache.find(value)
      a.updateOptions(results)
    })

    return { value, loading: true }
  },

  updateOptions: (symbols: WorkspaceSymbol[]) => ({ symbols, loading: false, index: 0 }),

  show: (symbols: WorkspaceSymbol[]) => (vimBlur(), { symbols, cache: symbols, visible: true, index: 0 }),
  hide: () => {
    symbolCache.clear()
    vimFocus()
    return resetState
  },
  // TODO: DON'T TRUNCATE!
  next: () => (s: S) => ({ index: s.index + 1 > 9 ? 0 : s.index + 1 }),
  prev: () => (s: S) => ({ index: s.index - 1 < 0 ? 9 : s.index - 1 }),
}

type A = typeof actions

const view = ($: S, a: A) => Plugin($.visible, [

  ,Input({
    select: a.select,
    change: a.change,
    hide: a.hide,
    next: a.next,
    prev: a.prev,
    value: $.value,
    loading: $.loading,
    focus: true,
    icon: Icon.Moon,
    desc: 'go to symbol',
  })

  // TODO: pls scroll this kthx
  ,h('div', {
    oncreate: (e: HTMLElement) => {
      pos.container = e.getBoundingClientRect()
    },
    style: {
      maxHeight: '50vh',
      overflowY: 'hidden',
    }
  }, $.symbols.map(({ name, kind }, ix) => h(RowNormal, {
    style: { justifyContent: 'space-between' },
    active: ix === $.index,
    oncreate: (e: HTMLElement) => {
      if (ix !== $.index) return
      const { top, bottom } = e.getBoundingClientRect()
      if (top < pos.container.top) return e.scrollIntoView(true)
      if (bottom > pos.container.bottom) return e.scrollIntoView(false)
    },
  }, [

    ,h('div', {
      style: { display: 'flex' },
    }, [

      ,h('div', {
        style: {
          display: 'flex',
          // TODO: this doesn't scale with font size?
          width: '24px',
          marginRight: '8px',
          alignItems: 'center',
          justifyContent: 'center',
        }
      }, [
        getSymbolIcon(kind),
      ])

      ,h('span', name)

    ])

    ,h('span', {
      style: {
        fontWeight: 'normal',
        color: 'rgba(255, 255, 255, 0.2)',
      }
    }, getSymbolDescription(kind).toLowerCase())

  ])))

])

const ui = app({ name: 'symbols', state, actions, view })

api.ai.workspaceSymbols.onShow(ui.show)
