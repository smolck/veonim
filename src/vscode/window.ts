import TextDocument from '../vscode/text-document'
import nvimSync from '../neovim/sync-api-client'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

const window: typeof vsc.window = {
  get activeTextEditor() {
    const currentBufferId = nvimSync(nvim => nvim.current.buffer.id).call()
    return TextDocument(currentBufferId)
  },
  get visibleTextEditors() {
    const visibleBuffersIds = nvimSync(async nvim => {
      const windows = await nvim.current.tabpage.windows
      const visibleBuffers = await Promise.all(windows.map(w => w.buffer))
      return visibleBuffers.map(b => b.id)
    }).call()
    return visibleBuffersIds.map(id => TextDocument(id))
  },
}

export default window
