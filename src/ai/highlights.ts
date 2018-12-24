import { highlights, references as getReferences } from '../langserv/adapter'
import { Highlight, HighlightGroupId } from '../neovim/types'
import { supports } from '../langserv/server-features'
import { request } from '../messaging/worker-client'
import { brighten } from '../ui/css'
import nvim from '../neovim/api'

const setHighlightColor = async () => {
  const colors = await request.getDefaultColors()
  const highlightColor = brighten(colors.background, 20)
  nvim.cmd(`highlight ${Highlight.DocumentHighlight} guibg=${highlightColor}`)
}

nvim.watchState.colorscheme(setHighlightColor)
setHighlightColor()

nvim.onAction('highlight', async () => {
  const referencesSupported = supports.references(nvim.state.cwd, nvim.state.filetype)
  const highlightsSupported = supports.highlights(nvim.state.cwd, nvim.state.filetype)
  const anySupport = highlightsSupported || referencesSupported

  if (!anySupport) return

  const { references } = highlightsSupported
    ? await highlights(nvim.state)
    : await getReferences(nvim.state)

  const buffer = nvim.current.buffer
  buffer.clearHighlight(HighlightGroupId.DocumentHighlight, 0, -1)

  if (!references.length) return

  references.forEach(hi => buffer.addHighlight(
    HighlightGroupId.DocumentHighlight,
    Highlight.DocumentHighlight,
    hi.line,
    hi.column,
    hi.endColumn,
  ))
})

nvim.onAction('highlight-clear', async () => {
  nvim.current.buffer.clearHighlight(HighlightGroupId.DocumentHighlight, 0, -1)
})
