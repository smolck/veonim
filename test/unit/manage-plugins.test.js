// TODO: update and convert to mocha
// const { join, normalize } = require('path')

// const NotifyKind = {
//   System: 'system',
//   Success: 'success',
// }

// const configPath = '/Users/liz/.config'
// const packPath = join(configPath, 'nvim/pack')

// const setup = ({ getDirsPaths = [], existsPaths = [] } = {}) => {
//   const mockExistPaths = new Set(existsPaths)
//   const mockDirsPaths = getDirsPaths.slice()
//   const mockNotifications = jest.fn()
//   const mockNoop = () => {}
//   const mockRemovePath = jest.fn()
//   const mockNotifyKind = NotifyKind
//   const mockNeovimCmd = jest.fn()
//   const mockConfigPath = configPath
//   const mockDownload = jest.fn(() => Promise.resolve(true))

//   jest.resetModules()

//   jest.mock('fs-extra', () => ({
//     remove: mockRemovePath,
//   }))

//   jest.mock('../../build/neovim/api', () => ({
//     cmd: mockNeovimCmd,
//   }))

//   jest.mock('../../build/support/download', () => ({
//     downloadRepo: mockDownload,
//   }))

//   jest.mock('../../build/support/utils', () => ({
//     readFile: mockNoop,
//     configPath: mockConfigPath,
//     watchPathSymlink: mockNoop,
//     is: { string: val => typeof val === 'string' },
//     exists: path => Promise.resolve(mockExistPaths.has(path)),
//     getDirs: () => Promise.resolve(mockDirsPaths)
//   }))

//   jest.mock('../../build/ui/notifications', () => ({
//     notify: mockNotifications,
//     NotifyKind: mockNotifyKind,
//   }))

//   const mp = require('../../build/support/manage-plugins')

//   return {
//     module: mp.default,
//     download: mockDownload,
//     removed: mockRemovePath,
//     neovimCmd: mockNeovimCmd,
//     notify: mockNotifications,
//   }
// }

// const configLines = [
//   `Plug 'tpope/vim-surround'`,
//   `Plug 'wellle/targets.vim'`,
// ]

// describe('manage plugins', () => {
//   test('download & install success', async () => {
//     const { module, notify, neovimCmd, removed, download } = setup()
//     await module(configLines)

//     // to contain number of processed plugins in the message
//     expect(notify.mock.calls[0][0]).toContain(2)
//     expect(notify.mock.calls[0][1]).toEqual(NotifyKind.System)
//     expect(notify.mock.calls[1][0]).toContain(2)
//     expect(notify.mock.calls[1][1]).toEqual(NotifyKind.Success)

//     expect(download.mock.calls[0]).toEqual([{
//       user: 'tpope',
//       repo: 'vim-surround',
//       destination: normalize('/Users/liz/.config/nvim/pack/tpope-vim-surround/start'),
//     }])

//     expect(download.mock.calls[1]).toEqual([{
//       user: 'wellle',
//       repo: 'targets.vim',
//       destination: normalize('/Users/liz/.config/nvim/pack/wellle-targets.vim/start'),
//     }])

//     expect(removed).not.toHaveBeenCalled()
//     expect(neovimCmd).toHaveBeenCalledWith('packloadall!')
//   })

//   test('no plugins found', async () => {
//     const { module, notify, neovimCmd, removed, download } = setup()
//     await module([])

//     expect(download).not.toHaveBeenCalled()
//     expect(notify).not.toHaveBeenCalled()
//     expect(removed).not.toHaveBeenCalled()
//     expect(neovimCmd).not.toHaveBeenCalled()
//   })

//   test('existing plugins', async () => {
//     const { module, notify, neovimCmd, removed, download } = setup({
//       existsPaths: [
//         join(packPath, 'tpope-vim-surround'),
//         join(packPath, 'wellle-targets.vim'),
//       ]
//     })

//     await module(configLines)

//     expect(download).not.toHaveBeenCalled()
//     expect(notify).not.toHaveBeenCalled()
//     expect(removed).not.toHaveBeenCalled()
//     expect(neovimCmd).not.toHaveBeenCalled()
//   })

//   test('1 new + 1 to be removed', async () => {
//     const { module, notify, neovimCmd, removed, download } = setup({
//       getDirsPaths: [
//         { name: 'tpope-vim-surround', path: join(packPath, 'tpope-vim-surround') },
//       ]
//     })

//     await module(configLines.slice(1))

//     expect(download.mock.calls[0]).toEqual([{
//       user: 'wellle',
//       repo: 'targets.vim',
//       destination: normalize('/Users/liz/.config/nvim/pack/wellle-targets.vim/start'),
//     }])
//     expect(removed.mock.calls[0][0]).toEqual(normalize('/Users/liz/.config/nvim/pack/tpope-vim-surround'))
//     expect(notify.mock.calls[0][0]).toContain(1)
//     expect(neovimCmd).toHaveBeenCalled()
//   })

//   test('bad config lines', async () => {
//     const { module, notify, neovimCmd, removed, download } = setup()

//     await module(['Plug lolumad?'])

//     expect(download).not.toHaveBeenCalled()
//     expect(notify).not.toHaveBeenCalled()
//     expect(removed).not.toHaveBeenCalled()
//     expect(neovimCmd).not.toHaveBeenCalled()
//   })
// })
