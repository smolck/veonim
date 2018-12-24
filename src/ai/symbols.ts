import { symbols, workspaceSymbols } from '../langserv/adapter'
import { supports } from '../langserv/server-features'
import { SymbolMode } from '../ai/protocol'
import nvim from '../neovim/api'
import { ui } from '../core/ai'

nvim.onAction('symbols', async () => {
  if (!supports.symbols(nvim.state.cwd, nvim.state.filetype)) return

  const listOfSymbols = await symbols(nvim.state)
  listOfSymbols && ui.symbols.show(listOfSymbols, SymbolMode.Buffer)
})

nvim.onAction('workspace-symbols', () => {
  if (supports.workspaceSymbols(nvim.state.cwd, nvim.state.filetype)) ui.symbols.show([], SymbolMode.Workspace)
})

export const getWorkspaceSymbols = (query: string) => workspaceSymbols(nvim.state, query)
