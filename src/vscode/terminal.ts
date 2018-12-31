import * as vsc from 'vscode'

export default (bufid: number): vsc.Terminal => ({
  get name() {
    return 'ala'
  },
  get processId() {

  },
})
