import nvimSync from '../neovim/sync-api-client'
import nvim from '../neovim/api'
import * as vsc from 'vscode'

export default (bufid: number): vsc.Terminal => ({
  get name() {
    return nvimSync((nvim, id) => nvim.Buffer(id).name).call(bufid)
  },
  get processId() {
    // TODO: is this the correct way of getting the pid? i can't find it in the docs
    // nvim.Buffer(bufid).getVar('b:terminal_job_pid')

      // *b:terminal_job_pid*	PID of the top-level process in a |:terminal|.
      // Use `jobpid(&channel)` instead.

  },
  sendText: (text, addNewLine = true) => {
    // TODO: how do we get the channel ID and do chansend? nvim api or have to eval?
    // - |'channel'| The nvim channel ID for the underlying PTY.
    //   |chansend()| can be used to send input to the terminal.
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
