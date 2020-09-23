import colorizer, { ColorData } from '../services/colorizer'
import * as markdown from '../support/markdown'
import { vscode } from '../core/extensions-api'
import { PromiseBoss } from '../support/utils'
import nvim from '../neovim/api'
import { ui } from '../core/ai'

const textByWord = (data: ColorData[]): ColorData[] =>
  data.reduce((res, item) => {
    const words = item.text.split(/(\s+)/)
    const items = words.map((m) => ({ color: item.color, text: m }))
    return [...res, ...items]
  }, [] as ColorData[])

const boss = PromiseBoss()

nvim.onAction('hover', async () => {
  nvim.untilEvent.cursorMove.then(boss.cancelCurrentPromise)
  const result = await boss.schedule(vscode.language.provideHover(), {
    timeout: 3e3,
  })
  if (!result) return
  const [value, doc] = result

  const cleanData = markdown.remove(value)
  const coloredLines: ColorData[][] = await colorizer.request.colorize(
    cleanData,
    nvim.state.filetype
  )
  const data = coloredLines
    .map((m) => textByWord(m))
    .map((m) => m.filter((m) => m.text.length))

  ui.hover.show({ data, doc })
})

nvim.on.cursorMove(() => ui.hover.hide())
nvim.on.insertEnter(() => ui.hover.hide())
nvim.on.insertLeave(() => ui.hover.hide())
