import { vscode } from '../core/extensions-api'
import { PromiseBoss } from '../support/utils'
import nvim from '../neovim/api'

const boss = PromiseBoss()

const doImplementation = async () => {
  const result = await boss.schedule(vscode.language.provideImplementation(), { timeout: 3e3 })
  if (!result) return
  const { path, range: { start } } = result

  nvim.jumpTo({
    path,
    line: start.line,
    column: start.character,
  })
}

nvim.onAction('implementation', doImplementation)
export default doImplementation
