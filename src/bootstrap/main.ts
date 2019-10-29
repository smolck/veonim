import { app, BrowserWindow, Menu, shell } from 'electron'
import settingsHandler from '../support/settings-handler'

let win: any
app.setName('veonim')

const comscan = (() => {
  type DispatchFn = (ch: string, message: any) => void
  const windows = new Set<DispatchFn>()
  const register = (fn: DispatchFn) => windows.add(fn)
  const dispatch = (ch: string, message: any) => windows.forEach(cb => cb(ch, message))
  return { register, dispatch }
})()

const settingsObject = settingsHandler().get()

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
      label: 'Developer Tools',
      accelerator: 'CmdOrCtrl+|',
      click: () => win.webContents.toggleDevTools(),
    }] as any // electron is stupid,
  } as any]

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
      role: 'quit' as any,
    }] as any // electron is stupid
  } as any)

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

  win = new BrowserWindow({
    width: settingsObject.width || 950,
    height: settingsObject.height || 700,
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

  if (settingsObject.pageX && settingsObject.pageY) win.setPosition(settingsObject.pageX, settingsObject.pageY)
  
  if (settingsObject.isFullscreen === true && win.isFullScreenable()) win.setFullScreen(true)

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

app.on('before-quit', () => {
  // Before quitting everything, take a snapshot for the current settings on this session
  const [ width, height ] = win.getSize();
  const [ pageX, pageY ] = win.getPosition();
  settingsHandler().set({
    width,
    height,
    pageX,
    pageY,
    isFullscreen: win.isFullScreen() || false,
  })
})
