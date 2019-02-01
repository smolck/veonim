import { supports } from '../langserv/server-features'
import { definition } from '../langserv/adapter'
import { vscode } from '../core/extensions-api'
import nvim from '../neovim/api'

const doVscodeDefintion = async () => {
  const { cancel, promise } = vscode.language.definition()
  console.log('vscode definition cancel token', cancel)
  const results = await promise
  if (!results) return
  const [ locations ] = results
  if (!locations) return
  if (Array.isArray(locations)) {
    const loc = locations[0]
    console.log('locations[0]', loc)
  } else {
    console.log('single location', locations)
  }
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
