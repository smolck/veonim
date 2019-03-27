import { app, BrowserWindow, Menu, shell } from 'electron'
import settingsHandler from '../support/settings-handler'

let win: any
let winProcessExplorer: any
app.setName('veonim')

const comscan = (() => {
  const windows = new Set()
  const register = (fn: (ch: string, msg: any) => void) => windows.add(fn)
  const dispatch = (ch: string, message: any) => windows.forEach(cb => cb(ch, message))
  return { register, dispatch }
})()

app.on('ready', async () => {
  const menuTemplate = [{
    label: 'Window',
    submenu: [{
      role: 'togglefullscreen',
    }, {
      label: 'Maximize',
      click: () => win.maximize(),
    }],
  }, {
    role: 'help',
    submenu: [{
      label: 'User Guide',
      click: () => shell.openExternal('https://github.com/veonim/veonim/blob/master/docs/readme.md'),
    }, {
      label: 'Report Issue',
      click: () => shell.openExternal('https://github.com/veonim/veonim/issues'),
    }, {
      type: 'separator',
    }, {
      label: 'Process Explorer',
      click: () => openProcessExplorer(),
    }, {
      label: 'Developer Tools',
      accelerator: 'CmdOrCtrl+|',
      click: () => win.webContents.toggleDevTools(),
    }] as any // electron is stupid,
  }]

  if (process.platform === 'darwin') menuTemplate.unshift({
    label: 'veonim',
    submenu: [{
      role: 'about',
    }, {
      type: 'separator',
    }, {
      // using 'role: hide' adds cmd+h keybinding which overrides vim keybinds
      label: 'Hide veonim',
      click: () => app.hide(),
    }, {
      type: 'separator',
    }, {
      role: 'quit',
    }] as any // electron is stupid
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

  win = new BrowserWindow({
    width: 950,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    frame: true,
    titleBarStyle: 'hidden',
    backgroundColor: '#222',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
    }
  })

  win.loadURL(`file:///${__dirname}/index.html`)
  comscan.register((ch, msg) => win.webContents.send(ch, msg))

  if (process.env.VEONIM_DEV) {
    function debounce (fn: Function, wait = 1) {
      let timeout: NodeJS.Timer
      return function(this: any, ...args: any[]) {
        const ctx = this
        clearTimeout(timeout)
        timeout = setTimeout(() => fn.apply(ctx, args), wait)
      }
    }

    const { watch } = require('fs')
    const srcDir = require('path').resolve(__dirname, '../../build')
    console.log('scrdir:', srcDir)

    const reloader = () => {
      console.log('reloading changes...')
      win.webContents.reload()
    }

    watch(srcDir, { recursive: true }, debounce(reloader, 250))

    console.log(`veonim started in develop mode. you're welcome`)

    const {
      default: installExtension,
      REACT_DEVELOPER_TOOLS,
      REDUX_DEVTOOLS,
    } = require('electron-devtools-installer')

    const load = (ext: any) => installExtension(ext)
      .then((n: any) => console.log('loaded ext:', n))
      .catch((e: any) => console.log('failed to load ext because...', e))

    // TODO: .id is a hack to make it work for electron 2.0+
    load(REACT_DEVELOPER_TOOLS.id)
    load(REDUX_DEVTOOLS.id)

    win.webContents.on('devtools-opened', () => setImmediate(() => win.focus()))
    win.webContents.openDevTools()
  }
})

const openProcessExplorer = () => {
  if (winProcessExplorer) {
    winProcessExplorer.close()
    winProcessExplorer = null
    return
  }

  winProcessExplorer = new BrowserWindow({
    width: 850,
    height: 600,
  })

  winProcessExplorer.on('close', () => winProcessExplorer = null)
  winProcessExplorer.loadURL(`file:///${__dirname}/process-explorer.html`)

  if (process.env.VEONIM_DEV) winProcessExplorer.openDevTools()
}
