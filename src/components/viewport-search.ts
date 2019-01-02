import { divinationSearch } from '../components/divination'
import { app, h, vimBlur, vimFocus } from '../ui/uikit'
import { currentWindowElement } from '../core/windows'
import { finder } from '../components/buffer-search'
import Input from '../components/text-input'
import { rgba, paddingV } from '../ui/css'
import * as Icon from 'hyperapp-feather'
import { makel } from '../ui/vanilla'
import nvim from '../core/neovim'

interface FilterResult {
  line: string,
  start: {
    line: number,
    column: number,
  },
  end: {
    line: number,
    column: number,
  }
}

let displayTargetJumps = true
const state = { value: '', focus: false }

type S = typeof state

const searchInBuffer = async (results = [] as FilterResult[]) => {
  if (!results.length) return nvim.cmd('noh')

  const parts = results
    .map(m => m.line.slice(m.start.column, m.end.column + 1))
    .filter((m, ix, arr) => arr.indexOf(m) === ix)
    .filter(m => m)
    .map(m => m.replace(/[\*\/\^\$\.\~\&]/g, '\\$&'))

  const pattern = parts.join('\\|')
  if (!pattern) return nvim.cmd('noh')

  nvim.cmd(`/\\%>${nvim.state.editorTopLine - 1}l\\%<${nvim.state.editorBottomLine + 1}l${pattern}`)
}


const actions = {
  show: () => {
    vimBlur()
    currentWindowElement.add(containerEl)
    return { focus: true }
  },
  hide: () => {
    vimFocus()
    currentWindowElement.remove(containerEl)
    return { value: '', focus: false }
  },
  change: (value: string) => {
    finder.request.visibleFuzzy(value).then((results: FilterResult[]) => {
      displayTargetJumps = results.length > 2
      searchInBuffer(results)
    })

    return { value }
  },
  select: () => {
    vimFocus()
    currentWindowElement.remove(containerEl)
    if (displayTargetJumps) divinationSearch()
    else nvim.feedkeys('n', 'n')
    return { value: '', focus: false }
  },
}

type A = typeof actions

const view = ($: S, a: A) => h('div', {
  style: {
    display: 'flex',
    flex: 1,
  },
}, [

  ,h('div', {
    style: {
      ...paddingV(20),
      display: 'flex',
      alignItems: 'center',
      // TODO: figure out a good color from the colorscheme... StatusLine?
      background: rgba(217, 150, 255, 0.17),
    }
  }, [
    ,h('span', 'viewport search')
  ])

  ,Input({
    small: true,
    focus: $.focus,
    value: $.value,
    desc: 'search query',
    icon: Icon.Search,
    hide: a.hide,
    change: a.change,
    select: a.select,
  })

])

const containerEl = makel({
  position: 'absolute',
  width: '100%',
  display: 'flex',
  backdropFilter: 'blur(24px)',
  background: `rgba(var(--background-30-alpha), 0.6)`,
  // TODO: this does not work with blur background. since backdrop-filter is
  // an experimental feature, it could be a bug.
  // actually backdrop-filter specification has a 'drop-shadow()' fn, but
  // i have not been able to make it work in chrome 61
  // boxShadow: '0 0 10px rgba(0, 0, 0, 0.6)',
})

const ui = app<S, A>({ name: 'viewport-search', state, actions, view, element: containerEl })

nvim.onAction('viewport-search', () => ui.show())
nvim.onAction('viewport-search-visual', async () => {
  await nvim.feedkeys('gv"zy')
  const selection = await nvim.expr('@z')
  ui.show()
  ui.change(selection)
})

export default ui.show
