import TextDocumentManager from '../neovim/text-document-manager'
import { WorkspaceWatcher } from '../vscode/workspace'
import TextDocument from '../vscode/text-document'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

export default (events: WorkspaceWatcher) => {
  const { on } = TextDocumentManager(nvim)

  on.didOpen(({ id }) => events.emit('didOpenTextDocument', TextDocument(id)))

  on.didChange(({ id, contentChanges }) => events.emit('didChangeTextDocument', {
    contentChanges,
    document: TextDocument(id),
  } as vsc.TextDocumentChangeEvent))

  on.willSave(({ id }) => events.emit('willSaveTextDocument', {
    document: TextDocument(id),
    reason: vsc.TextDocumentSaveReason.Manual,
    waitUntil: () => console.warn('willSave event waitUntil() not supported'),
  } as vsc.TextDocumentWillSaveEvent))

  on.didSave(({ id }) => events.emit('didSaveTextDocument', TextDocument(id)))

  on.didClose(({ id }) => events.emit('didCloseTextDocument', TextDocument(id)))
}
