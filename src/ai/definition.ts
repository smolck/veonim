import { supports } from '../langserv/server-features'
import { definition } from '../langserv/adapter'
import { vscode } from '../core/extensions-api'
import nvim from '../neovim/api'

const doVscodeDefintion = async () => {
  const { cancel, promise } = vscode.language.definition()
  // TODO: this is cute but doesn't work correctly
  // need to only call cancelRequest if the timeout
  // if timeout reached, we need to return from this func
  const result = await Promise.race([
    promise,
    new Promise(fin => setTimeout(fin, 5e3)).then(cancel),
  ])
  if (!result) return
  console.log('DEFINITION (path)', result.path, '(range)', result.range)
  nvim.jumpTo({
    path: result.path,
    line: result.range.start.line,
    column: result.range.start.character,
  })
}

const doDefinition = async () => {
  if (await nvim.g.veonim_enable_vscode) return doVscodeDefintion()

  if (!supports.definition(nvim.state.cwd, nvim.state.filetype)) return

  const { path, line, column } = await definition(nvim.state)
  if (!line || !column) return
  nvim.jumpTo({ path, line, column })
}

nvim.onAction('definition', doDefinition)
export default doDefinition
