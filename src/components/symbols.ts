import { getSymbolIcon, getSymbolDescription } from '../components/symbol-info'
import { Plugin } from '../components/plugin-container'
import { RowNormal } from '../components/row-container'
import { h, app, vimBlur, vimFocus } from '../ui/uikit'
import Input from '../components/text-input'
import { filter } from 'fuzzaldrin-plus'
import * as Icon from 'hyperapp-feather'
import { Symbol } from '../ai/protocol'
import api from '../core/instance-api'

const state = {
  loading: false,
  value: '',
  symbols: [] as Symbol[],
  cache: [] as Symbol[],
  visible: false,
  index: 0,
}

type S = typeof state

const pos: { container: ClientRect } = {
  container: { left: 0, right: 0, bottom: 0, top: 0, height: 0, width: 0 },
}

const symbolCache = (() => {
  let cache: Symbol[] = []

  const clear = () => (cache = [])
  const find = (query: string) => filter(cache, query, { key: 'name' })

  const update = (symbols: Symbol[]) => {
    symbols.forEach((s) => {
      const alreadyHas = cache.some((m) => m.name === s.name)
      if (!alreadyHas) cache.push(s)
    })
  }

  return { update, find, clear }
})()

const resetState = { value: '', visible: false, index: 0, loading: false }

const actions = {
  select: () => (s: S) => {
    vimFocus()
    if (!s.symbols.length) return symbolCache.clear(), resetState
    const {
      range: { start },
    } = s.symbols[s.index]
    api.nvim.jumpTo({
      line: start.line,
      column: start.character,
    })
    return symbolCache.clear(), resetState
  },

  change: (value: string) => (s: S) => {
    return {
      value,
      index: 0,
      symbols: value
        ? // TODO: DON'T TRUNCATE!
          filter(s.cache, value, { key: 'name' }).slice(0, 10)
        : s.cache.slice(0, 10),
    }
  },

  updateOptions: (symbols: Symbol[]) => ({ symbols, loading: false, index: 0 }),

  show: (symbols: Symbol[]) => (
    vimBlur(), { symbols, cache: symbols, visible: true, index: 0 }
  ),
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

const view = ($: S, a: A) =>
  Plugin($.visible, [
    ,
    Input({
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
    }),

    // TODO: pls scroll this kthx
    h(
      'div',
      {
        oncreate: (e: HTMLElement) => {
          pos.container = e.getBoundingClientRect()
        },
        style: {
          maxHeight: '50vh',
          overflowY: 'hidden',
        },
      },
      $.symbols.map(({ name, kind }, ix) =>
        h(
          RowNormal,
          {
            style: { justifyContent: 'space-between' },
            active: ix === $.index,
            oncreate: (e: HTMLElement) => {
              if (ix !== $.index) return
              const { top, bottom } = e.getBoundingClientRect()
              if (top < pos.container.top) return e.scrollIntoView(true)
              if (bottom > pos.container.bottom) return e.scrollIntoView(false)
            },
          },
          [
            ,
            h(
              'div',
              {
                style: { display: 'flex' },
              },
              [
                ,
                h(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      // TODO: this doesn't scale with font size?
                      width: '24px',
                      marginRight: '8px',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  },
                  [getSymbolIcon(kind)]
                ),

                h('span', name),
              ]
            ),

            h(
              'span',
              {
                style: {
                  fontWeight: 'normal',
                  color: 'rgba(255, 255, 255, 0.2)',
                },
              },
              getSymbolDescription(kind).toLowerCase()
            ),
          ]
        )
      )
    ),
  ])

const ui = app({ name: 'symbols', state, actions, view })
