import { supports } from '../langserv/server-features'
import { typeDefinition } from '../langserv/adapter'
import nvim from '../neovim/api'

nvim.onAction('type-definition', async () => {
  if (!supports.typeDefinition(nvim.state.cwd, nvim.state.filetype)) return

  const { path, line, column } = await typeDefinition(nvim.state)
  if (!line || !column) return
  nvim.jumpTo({ path, line, column })
})
