import { supports } from '../langserv/server-features'
import { definition } from '../langserv/adapter'
import { vscode } from '../core/extensions-api'
import nvim from '../neovim/api'

const doVscodeDefintion = async () => {
  const { cancel, promise } = vscode.providers.provideDefinition()
  console.log('vscode definition cancel token', cancel)
  const result = await promise
  console.log('result', result)
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
