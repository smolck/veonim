import { vscode } from '../core/extensions-api'
import { PromiseBoss } from '../support/utils'
import nvim from '../neovim/api'

const boss = PromiseBoss()

const doDefinition = async () => {
  const result = await boss.schedule(vscode.language.definition(), { timeout: 3e3 })

  if (!result) return

  nvim.jumpTo({
    path: result.path,
    line: result.range.start.line,
    column: result.range.start.character,
  })
}

nvim.onAction('definition', doDefinition)
export default doDefinition
