import { Highlight, HighlightGroupId } from '../neovim/types'
import { request } from '../messaging/worker-client'
import { vscode } from '../core/extensions-api'
import { PromiseBoss } from '../support/utils'
import { brighten } from '../ui/css'
import nvim from '../neovim/api'

const boss = PromiseBoss()

const setHighlightColor = async () => {
  const colors = await request.getDefaultColors()
  const highlightColor = brighten(colors.background, 20)
  nvim.cmd(`highlight ${Highlight.DocumentHighlight} guibg=${highlightColor}`)
}

nvim.watchState.colorscheme(setHighlightColor)
setHighlightColor()

export const highlight = async () => {
  const highlights = await boss.schedule(
    vscode.language.provideDocumentHighlights(),
    { timeout: 3e3 }
  )
  if (!highlights) return

  const buffer = nvim.current.buffer
  buffer.clearHighlight(HighlightGroupId.DocumentHighlight, 0, -1)

  highlights.forEach((hi) =>
    buffer.addHighlight(
      HighlightGroupId.DocumentHighlight,
      Highlight.DocumentHighlight,
      hi.range.start.line,
      hi.range.start.character,
      hi.range.end.character
    )
  )
}

nvim.onAction('highlight', highlight)

nvim.onAction('highlight-clear', async () => {
  nvim.current.buffer.clearHighlight(HighlightGroupId.DocumentHighlight, 0, -1)
})
