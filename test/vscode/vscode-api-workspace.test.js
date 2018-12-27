const { src, same, testDataPath } = require('../util')
const startNeovim = require('../nvim-for-test')
const path = require('path')
const { EV_CREATE_VIM, EV_SWITCH_VIM } = src('support/constants')

describe('vscode api - workspace', () => {
  let workspace
  let nvim
  let pipeName

  before(() => {
    global.onmessage = () => {}
    global.postMessage = () => {}
  })

  after(() => {
    delete global.onmessage
    delete global.postMessage
  })

  beforeEach(async () => {
    nvim = startNeovim()
    workspace = src('vscode/workspace').default
    pipeName = await nvim.request('eval', 'v:servername')

    global.onmessage({ data: [EV_CREATE_VIM, [{ id: 1, path: pipeName }]] })
    global.onmessage({ data: [EV_SWITCH_VIM, [1]] })

    const nvimSRC = src('vscode/neovim').default

    nvim.notify('command', `:cd ${testDataPath}`)

    // wait for NeovimState to be populated
    await new Promise((done, fail) => {
      const timer = setInterval(() => {
        if (nvimSRC.state.cwd === testDataPath) {
          clearInterval(timer)
          done()
        }
      }, 100)

      setTimeout(() => {
        clearInterval(timer)
        fail(`nvim cwd was never === ${testDataPath}`)
      }, 8e3)
    })
  })

  afterEach(() => {
    nvim.shutdown()
  })

  describe('var', () => {
    it('rootPath', () => {
      same(workspace.rootPath, testDataPath)
    })

    it('workspaceFolders', () => {
      same(workspace.workspaceFolders, [ testDataPath ])
    })

    it('name', () => {
      const baseFolderName = path.basename(testDataPath)
      same(workspace.name, baseFolderName)
    })

    it('textDocuments')
  })

  describe('events', () => {
    it('onWillSaveTextDocument')
    it('onDidChangeWorkspaceFolders')
    it('onDidOpenTextDocument')
    it('onDidCloseTextDocument')
    it('onDidChangeTextDocument')
    it('onDidSaveTextDocument')
    it('onDidChangeConfiguration')
  })

  describe('func', () => {
    it('getWorkspaceFolder')
    it('asRelativePath')
    it('updateWorkspaceFolders')
    it('createFileSystemWatcher')
    it('findFiles')
    it('saveAll')
    it('applyEdit')
    it('openTextDocument')
    it('openTextDocument')
    it('openTextDocument')
    it('registerTextDocumentContentProvider')
    it('getConfiguration')
    it('registerTaskProvider')
    it('registerFileSystemProvider')
  })
})
