import nvim from '../neovim/api'
import { remote } from 'electron'

nvim.onAction('version', () => nvim.cmd(`echo 'Veonim v${remote.app.getVersion()}'`))
nvim.onAction('hide', () => remote.app.hide())
nvim.onAction('quit', () => remote.app.quit())
nvim.onAction('maximize', () => remote.getCurrentWindow().maximize())
nvim.onAction('devtools', () => remote.getCurrentWebContents().toggleDevTools())
nvim.onAction('fullscreen', () => {
  const win = remote.getCurrentWindow()
  win.setFullScreen(!win.isFullScreen())
})
