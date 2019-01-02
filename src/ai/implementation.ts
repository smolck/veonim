import { EditorLocation, implementation, definition } from '../langserv/adapter'
import { supports } from '../langserv/server-features'
import nvim from '../neovim/api'

interface StateLocation {
  absoluteFilepath: string
  line: number
  column: number
}

const recursiveDefinition = async (stateLocation: StateLocation): Promise<EditorLocation> => {
  const { path, line, column } = await definition(Object.assign(nvim.state, stateLocation))

  if (!path || !line || !column) return {
    path: stateLocation.absoluteFilepath,
    line: stateLocation.line,
    column: stateLocation.column,
  }

  return recursiveDefinition({ line, column, absoluteFilepath: path })
}

nvim.onAction('implementation', async () => {
  const implementationSupported = supports.implementation(nvim.state.cwd, nvim.state.filetype)
  const definitionSupported = supports.definition(nvim.state.cwd, nvim.state.filetype)
  const anySupport = implementationSupported || definitionSupported

  if (!anySupport) return

  const { path, line, column } = implementationSupported
    ? await implementation(nvim.state)
    : await recursiveDefinition(nvim.state)

  if (!line || !column) return
  nvim.jumpTo({ path, line, column })
})
