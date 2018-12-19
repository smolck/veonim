import colorizer, { ColorData } from '../services/colorizer'
import { supports } from '../langserv/server-features'
import * as markdown from '../support/markdown'
import { hover } from '../langserv/adapter'
import { ui } from '../components/hover'
import nvim from '../neovim/api'

const textByWord = (data: ColorData[]): ColorData[] => data.reduce((res, item) => {
  const words = item.text.split(/(\s+)/)
  const items = words.map(m => ({ color: item.color, text: m }))
  return [...res, ...items]
}, [] as ColorData[])

nvim.onAction('hover', async () => {
  if (!supports.hover(nvim.state.cwd, nvim.state.filetype)) return

  const { value, doc } = await hover(nvim.state)
  if (!value) return

  const cleanData = markdown.remove(value)
  const coloredLines: ColorData[][] = await colorizer.request.colorize(cleanData, nvim.state.filetype)
  const data = coloredLines
    .map(m => textByWord(m))
    .map(m => m.filter(m => m.text.length))

  ui.show({ data, doc })
})

nvim.on.cursorMove(ui.hide)
nvim.on.insertEnter(ui.hide)
nvim.on.insertLeave(ui.hide)
