import nvimSync from '../neovim/sync-api-client'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

export default (bufid: number): vsc.Terminal => ({
  get name() {
    return nvimSync((nvim, id) => nvim.Buffer(id).name).call(bufid)
  },
  get processId() {
    return nvim
      .Buffer(bufid)
      .getVar('channel')
      .then((channelId) => nvim.call.jobpid(channelId))
  },
  sendText: async (text, addNewLine = true) => {
    const channelId = await nvim.Buffer(bufid).getVar('channel')
    // as per nvim docs, to send a final newline, include a final empty string
    nvim.call.chansend(channelId, addNewLine ? [text, ''] : text)
  },
  show: () => {
    // TODO: not sure about the UX here. we don't use terminal panel like vscode
    console.warn('NYI: terminal.show')
  },
  hide: () => {
    // TODO: not sure about the UX here. we don't use terminal panel like vscode
    console.warn('NYI: terminal.show')
  },
  dispose: () => {
    // TODO: what do we do here? delete the term buffer?
    console.warn('NYI: terminal.dispose')
  },
})
