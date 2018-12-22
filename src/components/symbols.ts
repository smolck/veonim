import { SymbolKind } from 'vscode-languageserver-protocol'
import { Plugin } from '../components/plugin-container'
import { RowNormal } from '../components/row-container'
import { h, app, vimBlur, vimFocus } from '../ui/uikit'
import Input from '../components/text-input'
import { Symbol } from '../langserv/adapter'
import { SymbolMode } from '../ai/protocol'
import { filter } from 'fuzzaldrin-plus'
import * as Icon from 'hyperapp-feather'
import api from '../core/instance-api'
import { join } from 'path'

const state = {
  loading: false,
  mode: SymbolMode.Buffer,
  value: '',
  symbols: [] as Symbol[],
  cache: [] as Symbol[],
  visible: false,
  index: 0,
}

type S = typeof state

const pos: { container: ClientRect } = {
  container: { left: 0, right: 0, bottom: 0, top: 0, height: 0, width: 0 }
}

const icons = new Map([
  [ SymbolKind.File, h(Icon.File, { color: '#a5c3ff' }) ],
  [ SymbolKind.Module, h(Icon.Grid, { color: '#ff5f54' }) ],
  [ SymbolKind.Namespace, h(Icon.CloudSnow, { color: '#ffadc5' }) ],
  [ SymbolKind.Package, h(Icon.Package, { color: '#ffa4d0' }) ],
  [ SymbolKind.Class, h(Icon.Compass, { color: '#ffeb5b' }) ],
  [ SymbolKind.Method, h(Icon.Box, { color: '#bb5ef1' }) ],
  [ SymbolKind.Property, h(Icon.Disc, { color: '#54c8ff' }) ],
  [ SymbolKind.Field, h(Icon.Feather, { color: '#9866ff' }) ],
  [ SymbolKind.Constructor, h(Icon.Aperture, { color: '#c9ff56' }) ],
  [ SymbolKind.Enum, h(Icon.Award, { color: '#84ff54' }) ],
  [ SymbolKind.Interface, h(Icon.Map, { color: '#ffa354' }) ],
  [ SymbolKind.Function, h(Icon.Share2, { color: '#6da7ff' }) ],
  [ SymbolKind.Variable, h(Icon.Database, { color: '#ff70e4' }) ],
  [ SymbolKind.Constant, h(Icon.Save, { color: '#54ffe5' }) ],
  [ SymbolKind.String, h(Icon.Star, { color: '#ffdca3' }) ],
  [ SymbolKind.Number, h(Icon.Hash, { color: '#ff0c53' }) ],
  [ SymbolKind.Boolean, h(Icon.Flag, { color: '#0c2dff' }) ],
  [ SymbolKind.Array, h(Icon.Film, { color: '#0cffff' }) ],
  // TODO: we need some colors pls
  [ SymbolKind.Object, h(Icon.Copy, { color: '#ccc' }) ],
  [ SymbolKind.Key, h(Icon.Tag, { color: '#ccc' }) ],
  [ SymbolKind.Null, h(Icon.XSquare, { color: '#ccc' }) ],
  [ SymbolKind.EnumMember, h(Icon.Menu, { color: '#ccc' }) ],
  [ SymbolKind.Struct, h(Icon.Layers, { color: '#ccc' }) ],
  [ SymbolKind.Event, h(Icon.Video, { color: '#ccc' }) ],
  [ SymbolKind.Operator, h(Icon.Anchor, { color: '#ccc' }) ],
  [ SymbolKind.TypeParameter, h(Icon.Type, { color: '#ccc' }) ],
])

const symbolDescription = new Map([
  [ SymbolKind.File, 'File' ],
  [ SymbolKind.Module, 'Module' ],
  [ SymbolKind.Namespace, 'Namespace' ],
  [ SymbolKind.Package, 'Package' ],
  [ SymbolKind.Class, 'Class' ],
  [ SymbolKind.Method, 'Method' ],
  [ SymbolKind.Property, 'Property' ],
  [ SymbolKind.Field, 'Field' ],
  [ SymbolKind.Constructor, 'Constructor' ],
  [ SymbolKind.Enum, 'Enum' ],
  [ SymbolKind.Interface, 'Interface' ],
  [ SymbolKind.Function, 'Function' ],
  [ SymbolKind.Variable, 'Variable' ],
  [ SymbolKind.Constant, 'Constant' ],
  [ SymbolKind.String, 'String' ],
  [ SymbolKind.Number, 'Number' ],
  [ SymbolKind.Boolean, 'Boolean' ],
  [ SymbolKind.Array, 'Array' ],
  [ SymbolKind.Object, 'Object' ],
  [ SymbolKind.Key, 'Key' ],
  [ SymbolKind.Null, 'Null' ],
  [ SymbolKind.EnumMember, 'EnumMember' ],
  [ SymbolKind.Struct, 'Struct' ],
  [ SymbolKind.Event, 'Event' ],
  [ SymbolKind.Operator, 'Operator' ],
  [ SymbolKind.TypeParameter, 'TypeParameter' ],
])

const getSymbolIcon = (kind: SymbolKind) => icons.get(kind) || h(Icon.Code)
const getSymbolDescription = (kind: SymbolKind) => symbolDescription.get(kind) || ''

const symbolCache = (() => {
  let cache: Symbol[] = []

  const clear = () => cache = []
  const find = (query: string) => filter(cache, query, { key: 'name' })

  const update = (symbols: Symbol[]) => {
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
    const { location: { cwd, file, position } } = s.symbols[s.index]
    const path = join(cwd, file)
    api.nvim.jumpTo({ ...position, path })
    return (symbolCache.clear(), resetState)
  },

  change: (value: string) => (s: S, a: A) => {
    if (s.mode === SymbolMode.Buffer) return { value, index: 0, symbols: value
      // TODO: DON'T TRUNCATE!
      ? filter(s.cache, value, { key: 'name' }).slice(0, 10)
      : s.cache.slice(0, 10)
    } 

    if (s.mode === SymbolMode.Workspace) {
      api.ai.symbols.getWorkspaceSymbols(value).then(symbols => {
        symbolCache.update(symbols)
        const results = symbols.length ? symbols : symbolCache.find(value)
        a.updateOptions(results)
      })

      return { value, loading: true }
    }
  },

  updateOptions: (symbols: Symbol[]) => ({ symbols, loading: false, index: 0 }),

  show: ({ symbols, mode }: any) => (vimBlur(), { mode, symbols, cache: symbols, visible: true, index: 0 }),
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

api.ai.symbols.onShow((symbols: Symbol[], mode: SymbolMode) => ui.show({ symbols, mode }))
