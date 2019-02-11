import { RowNormal, RowComplete } from '../components/row-container'
import { resetMarkdownHTMLStyle } from '../ui/styles'
import { CompletionItemKind } from '../vscode/types'
import { CompletionOption } from '../ai/completions'
import { markdownToHTML } from '../support/markdown'
import * as windows from '../windows/window-manager'
import * as dispatch from '../messaging/dispatch'
import { CompletionShow } from '../ai/protocol'
import * as workspace from '../core/workspace'
import { paddingVH, cvar } from '../ui/css'
import Overlay from '../components/overlay'
import * as Icon from 'hyperapp-feather'
import { MarkdownString } from 'vscode'
import { cursor } from '../core/cursor'
import api from '../core/instance-api'
import { h, app } from '../ui/uikit'

const MAX_VISIBLE_OPTIONS = 12

const state = {
  x: 0,
  y: 0,
  ix: 0,
  anchorAbove: false,
  options: [] as CompletionOption[],
  visible: false,
  documentation: {} as any,
  visibleOptions: MAX_VISIBLE_OPTIONS,
}

type S = typeof state

// const pos: { container: ClientRect } = {
//   container: { left: 0, right: 0, bottom: 0, top: 0, height: 0, width: 0 }
// }

const icons = new Map([
  [ CompletionItemKind.Text, h(Icon.ChevronsRight) ],
  [ CompletionItemKind.Method, h(Icon.Box, { color: '#bb5ef1' }) ],
  [ CompletionItemKind.Property, h(Icon.Disc, { color: '#54c8ff' }) ],
  [ CompletionItemKind.Function, h(Icon.Share2, { color: '#6da7ff' }) ],
  [ CompletionItemKind.Constructor, h(Icon.Aperture, { color: '#c9ff56' }) ],
  [ CompletionItemKind.Field, h(Icon.Feather, { color: '#9866ff' }) ],
  [ CompletionItemKind.Variable, h(Icon.Database, { color: '#ff70e4' }) ],
  [ CompletionItemKind.Class, h(Icon.Compass, { color: '#ffeb5b' }) ],
  [ CompletionItemKind.Interface, h(Icon.Map, { color: '#ffa354' }) ],
  [ CompletionItemKind.Module, h(Icon.Grid, { color: '#ff5f54' }) ],
  [ CompletionItemKind.Unit, h(Icon.Cpu, { color: '#ffadc5' }) ],
  [ CompletionItemKind.Value, h(Icon.Bell, { color: '#ffa4d0' }) ],
  [ CompletionItemKind.Enum, h(Icon.Award, { color: '#84ff54' }) ],
  [ CompletionItemKind.Keyword, h(Icon.Navigation, { color: '#ff0c53' }) ],
  [ CompletionItemKind.Snippet, h(Icon.Paperclip, { color: '#0c2dff' }) ],
  [ CompletionItemKind.Color, h(Icon.Eye, { color: '#54ffe5' }) ],
  [ CompletionItemKind.File, h(Icon.File, { color: '#a5c3ff' }) ],
  [ CompletionItemKind.Reference, h(Icon.Link, { color: '#ffdca3' }) ],
  // TODO: we need some colors pls
  [ CompletionItemKind.Folder, h(Icon.Folder, { color: '#ccc' }) ],
  [ CompletionItemKind.EnumMember, h(Icon.Menu, { color: '#ccc' }) ],
  [ CompletionItemKind.Constant, h(Icon.Save, { color: '#ccc' }) ],
  [ CompletionItemKind.Struct, h(Icon.Layers, { color: '#ccc' }) ],
  [ CompletionItemKind.Event, h(Icon.Video, { color: '#ccc' }) ],
  [ CompletionItemKind.Operator, h(Icon.Anchor, { color: '#ccc' }) ],
  [ CompletionItemKind.TypeParameter, h(Icon.Type, { color: '#ccc' }) ],
])

const getCompletionIcon = (kind: CompletionItemKind) => icons.get(kind) || h(Icon.Code)

// TODO: move to common place. used in other places like signature-hint
const parseDocs = async (docs?: string | MarkdownString): Promise<string | undefined> => {
  if (!docs) return
  return typeof docs === 'string' ? docs : markdownToHTML(docs.value)
}

const docs = (data: string) => h(RowNormal, {
  style: {
    ...paddingVH(6, 4),
    // RowNormal gives us display: flex but this causes things
    // to be flex-flow: row. we just want the standard no fancy pls kthx
    display: 'block',
    paddingTop: '6px',
    overflow: 'visible',
    whiteSpace: 'normal',
    color: cvar('foreground-20'),
    background: cvar('background-45'),
    fontSize: `${workspace.font.size - 2}px`,
  },
  oncreate: (e: HTMLElement) => e.innerHTML = `<div class="${resetMarkdownHTMLStyle}">${data}</div>`,
})

const actions = {
  hide: () => ({ visible: false, ix: 0 }),

  showDocs: (documentation: any) => ({ documentation }),

  show: ({ anchorAbove, visibleOptions, options, x, y, ix = -1 }: any) => ({
    visibleOptions,
    anchorAbove,
    options,
    ix,
    x,
    y,
    visible: true,
    documentation: undefined
  }),

  select: (ix: number) => (s: S, a: typeof actions) => {
    const completionItem = (s.options[ix] || {}).raw
    // raw could be missing if not semantic completions
    if (!completionItem) return { ix, documentation: undefined }

    const { detail, documentation } = completionItem
    // TODO: what are we doing with detail and documentation?
    // show both? or one or the other?

    if (!detail || !documentation) (async () => {
      // TODO: what do with .detail?
      const details = await api.ai.completions.getDetail(completionItem)
      if (!details.documentation) return
      const richFormatDocs = await parseDocs(details.documentation)
      a.showDocs(richFormatDocs)
    })()

    return { ix, documentation: documentation || detail }
  },
}

const view = ($: S) => Overlay({
  x: $.x,
  y: $.y,
  zIndex: 200,
  maxWidth: 400,
  visible: $.visible,
  anchorAbove: $.anchorAbove,
}, [

  ,$.documentation && $.anchorAbove && docs($.documentation)

  ,h('div', {
    // onupdate: (e: HTMLElement) => pos.container = e.getBoundingClientRect(),
    style: {
      overflowY: 'hidden',
      background: cvar('background-30'),
      maxHeight: `${workspace.cell.height * $.visibleOptions}px`,
    }
  }, $.options.map(({ text, kind }, id) => h(RowComplete, {
    key: `${text}-${kind}`,
    active: id === $.ix,
    // TODO: no scrolling because slow
    // onupdate: (e: HTMLElement) => {
    //   if (id !== $.ix) return
    //   const { top, bottom } = e.getBoundingClientRect()
    //   if (top < pos.container.top) return e.scrollIntoView(true)
    //   if (bottom > pos.container.bottom) return e.scrollIntoView(false)
    // },
  }, [
    ,h('div', {
      style: {
        display: 'flex',
        // TODO: this doesn't scale with font size?
        width: '24px',
        marginRight: '2px',
        alignItems: 'center',
        justifyContent: 'center',
      }
    }, [
      getCompletionIcon(kind),
    ])

    ,h('div', text)
  ])))

  ,$.documentation && !$.anchorAbove && docs($.documentation)

])

const ui = app<S, typeof actions>({ name: 'autocomplete', state, actions, view })

export const hide = () => ui.hide()
export const select = (index: number) => ui.select(index)
export const show = ({ row, col, options }: CompletionShow) => {
  const visibleOptions = Math.min(MAX_VISIBLE_OPTIONS, options.length)
  const anchorAbove = cursor.row + visibleOptions > workspace.size.rows 

  ui.show({
    anchorAbove,
    visibleOptions,
    options: options.slice(0, visibleOptions),
    ...windows.pixelPosition(anchorAbove ? row : row + 1, col),
  })
}

api.ai.completions.onShow(show)
api.ai.completions.onHide(hide)

dispatch.sub('pmenu.select', ix => select(ix))
dispatch.sub('pmenu.hide', hide)
