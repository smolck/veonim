import { supports } from '../langserv/server-features'
import { definition } from '../langserv/adapter'
import nvim from '../neovim/api'

const doDefinition = async () => {
  if (!supports.definition(nvim.state.cwd, nvim.state.filetype)) return

  const { path, line, column } = await definition(nvim.state)
  if (!line || !column) return
  nvim.jumpTo({ path, line, column })
}

nvim.onAction('definition', doDefinition)
export default doDefinition
