import { vscode } from '../core/extensions-api'
import { PromiseBoss } from '../support/utils'
import nvim from '../neovim/api'
import { ui } from '../core/ai'

const symbolBoss = PromiseBoss()
const workspaceBoss = PromiseBoss()

nvim.onAction('symbols', async () => {
  ui.symbols.show([])
  // TODO: show pending spinner
  // show symbol cache on load?
  const symbols = await symbolBoss.schedule(vscode.language.provideDocumentSymbols(), { timeout: 3e3 })
  if (!symbols) return
  ui.symbols.show(symbols)
})

nvim.onAction('workspace-symbols', () => {
  // TODO: show something in the UI to indicate that we need to type
  // perhaps we load the current document symbols as a starter?
  ui.workspaceSymbols.show([])
})

export const getWorkspaceSymbols = (query: string) => {
  return workspaceBoss.schedule(vscode.language.provideWorkspaceSymbols(query), { timeout: 10e3 })
}
