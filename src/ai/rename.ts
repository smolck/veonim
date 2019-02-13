import { vscode } from '../core/extensions-api'
import { Position } from '../vscode/types'
import nvim from '../neovim/api'

// TODO: anyway to improve the glitchiness of undo/apply edit? any way to also pause render in undo
// or maybe figure out how to diff based on the partial modification
// call atomic? tricky with getting target lines for replacements
// even if done before atomic operations, line numbers could be off
const doRename = async () => {
  vscode.textSync.pause()
  const position = new Position(nvim.state.line, nvim.state.column)
  nvim.feedkeys('ciw')
  await nvim.untilEvent.insertLeave
  const newName = await nvim.expr('@.')
  nvim.feedkeys('u')
  vscode.textSync.resume()

  if (!newName) return
  const success = await vscode.language.renameSymbol(position, newName).promise
  console.log('rename operation success?', success)
}

nvim.onAction('rename', doRename)
export default doRename
