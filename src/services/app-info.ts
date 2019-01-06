import api from '../core/instance-api'
import { remote } from 'electron'

api.onAction('version', () => api.nvim.cmd(`echo 'Veonim v${remote.app.getVersion()}'`))
api.onAction('devtools', () => remote.getCurrentWebContents().toggleDevTools())
