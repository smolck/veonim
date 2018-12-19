// import { getDirFiles, pathRelativeToHome, pathRelativeToCwd, getDirs, $HOME } from '../support/utils'
// import { RowNormal, RowImportant } from '../components/row-container'
// import FiletypeIcon, { Folder } from '../components/filetype-icon'
// // import { registerShadowComponent } from '../core/shadow-buffers'
// import { join, sep, basename, dirname } from 'path'
// import { input } from '../core/master-control'
// import config from '../config/config-service'
// import Input from '../components/text-input'
// import { filter } from 'fuzzaldrin-plus'
// import * as Icon from 'hyperapp-feather'
// import { colors } from '../ui/styles'
// import { h, app } from '../ui/uikit'
// import nvim from '../neovim/api'
// import { cvar } from '../ui/css'

// interface FileDir {
//   name: string,
//   file: boolean,
//   dir: boolean,
// }

// const ignored: { dirs: string[], files: string[] } = {
//   dirs: config('explorer.ignore.dirs', m => ignored.dirs = m),
//   files: config('explorer.ignore.files', m => ignored.files = m),
// }

// const sortDirFiles = (filedirs: FileDir[]) => {
//   const dirs = filedirs.filter(f => f.dir && !ignored.dirs.includes(f.name))
//   const files = filedirs.filter(f => f.file && !ignored.files.includes(f.name))
//   return [...dirs, ...files]
// }

// const absolutePath = (path: string) => path.replace(/^~\//, `${$HOME}/`) 

// const pathExplore = async (path: string) => {
//   const fullpath = absolutePath(path)
//   const complete = fullpath.endsWith('/')
//   const dir = complete ? fullpath : dirname(fullpath)
//   const top = basename(fullpath)
//   const dirs = await getDirs(dir)
//   const goodDirs = dirs.filter(d => !ignored.dirs.includes(d.name))
//   return complete ? goodDirs : filter(goodDirs, top, { key: 'name' })
// }

// const createComponent = () => {
//   const state = {
//     focus: false,
//     val: '',
//     cwd: '',
//     path: '',
//     paths: [] as FileDir[],
//     cache: [] as FileDir[],
//     ix: 0,
//     pathMode: false,
//     pathValue: '',
//   }

//   const resetState = { val: '', path: '', ix: 0 }
//   let pathInputRef: HTMLInputElement
//   let listElRef: HTMLElement

//   type S = typeof state
//   type A = typeof actions

//   const actions = {
//     // TODO: when choosing custom path and go back, make sure it updates correctly
//     // like ~/proj/veonim/ -> OK
//     // but  ~/proj/veonim -> DERP!

//     ctrlG: () => ({ pathMode: true, ix: 0, val: '', pathValue: '' }),

//     completePath: () => (s: S) => {
//       if (!s.paths.length) return
//       const dir = dirname(absolutePath(s.pathValue))
//       const { name } = s.paths[s.ix]
//       const next = `${join(dir, name)}/`
//       pathExplore(next).then(ui.updatePaths)
//       return { ix: 0, pathValue: next }
//     },

//     normalMode: () => ({ pathMode: false }),
//     updatePaths: (paths: FileDir[]) => ({ paths }),

//     updateCwdStuff: ({ cwd, paths }: any) => ({ cwd, paths, path: cwd }),

//     selectPath: () => (s: S) => {
//       if (!s.pathValue) return { pathMode: false, ix: 0 }
//       getDirFiles(s.pathValue).then(paths => ui.updatePaths(sortDirFiles(paths)))
//       return { pathMode: false, path: s.pathValue, ix: 0 }
//     },

//     changePath: (pathValue: string) => () => {
//       pathExplore(pathValue).then(ui.updatePaths)
//       return { pathValue }
//     },

//     nextPath: () => (s: S) => {
//       const ix = s.ix + 1 >= s.paths.length ? 0 : s.ix + 1
//       const fullpath = absolutePath(s.pathValue)
//       const goodPath = fullpath.endsWith('/') ? fullpath : dirname(fullpath)
//       const { name } = s.paths[ix]
//       const pathValue = `${join(goodPath, name)}`
//       return { ix, pathValue }
//     },

//     prevPath: () => (s: S) => {
//       const ix = s.ix - 1 < 0 ? s.paths.length - 1 : s.ix - 1
//       const fullpath = absolutePath(s.pathValue)
//       const goodPath = fullpath.endsWith('/') ? fullpath : dirname(fullpath)
//       const { name } = s.paths[ix]
//       const pathValue = `${join(goodPath, name)}`
//       return { ix, pathValue }
//     },

//     select: () => (s: S) => {
//       if (!s.paths.length) return resetState

//       const { name, file } = s.paths[s.ix]
//       if (!name) return

//       if (file) {
//         nvim.cmd(`e ${pathRelativeToCwd(join(s.path, name), s.cwd)}`)
//         return resetState
//       }

//       const path = join(s.path, name)
//       getDirFiles(path).then(paths => ui.show({ path, paths: sortDirFiles(paths) }))
//     },

//     change: (val: string) => (s: S) => {
//       if (s.val === val) return

//       return { val, ix: 0, paths: val
//         ? sortDirFiles(filter(s.paths, val, { key: 'name' }))
//         : s.cache
//       }
//     },

//     // TODO: find a different keybind for this since ctrl-h now needs to server
//     // global vim window navigation keybinds
//     // ctrlH: async () => {
//     //   const { cwd } = current
//     //   const filedirs = await getDirFiles(cwd)
//     //   const paths = sortDirFiles(filedirs)
//     //   ui.show({ paths, cwd, path: cwd })
//     // },

//     jumpPrev: () => (s: S) => {
//       const next = s.path.split(sep)
//       next.pop()
//       const path = join(sep, ...next)
//       getDirFiles(path).then(paths => ui.show({ path, paths: sortDirFiles(paths) }))
//     },

//     focus: () => (s: S) => {
//       const projectDirChanged = s.cwd !== nvim.state.cwd

//       if (projectDirChanged) getDirFiles(nvim.state.cwd).then(dirs => ui.updateCwdStuff({
//         cwd: nvim.state.cwd,
//         paths: sortDirFiles(dirs),
//       }))

//       return { focus: true }
//     },

//     blur: () => ({ focus: false }),

//     show: ({ paths, path, cwd }: any) => (s: S) => ({
//       ...resetState,
//       path,
//       paths,
//       cache: paths,
//       cwd: cwd || s.cwd,
//     }),

//     // TODO: be more precise than this? also depends on scaled devices
//     down: () => (s: S) => {
//       listElRef.scrollTop += 300
//       return { ix: Math.min(s.ix + 17, s.paths.length - 1) }
//     },

//     up: () => (s: S) => {
//       listElRef.scrollTop -= 300
//       return { ix: Math.max(s.ix - 17, 0) }
//     },

//     top: () => { listElRef.scrollTop = 0 },
//     bottom: () => { listElRef.scrollTop = listElRef.scrollHeight },

//     closeWindow: () => {
//       input('<c-w>q')
//       return { focus: false }
//     },
//     next: () => {
//       input('<c-j>')
//       return { focus: false }
//     },
//     prev: () => {
//       input('<c-k>')
//       return { focus: false }
//     },
//     ctrlL: () => {
//       input('<c-l>')
//       return { focus: false }
//     },
//     ctrlH: () => {
//       input('<c-h>')
//       return { focus: false }
//     },
//     // use tab + shift-tab
//     // TODO: find different keybinds for next/prev since ctrl + hjkl need to be
//     // for global vim window navigation
//     // next: (s: S) => ({ ix: s.ix + 1 >= s.paths.length ? 0 : s.ix + 1 }),
//     // prev: (s: S) => ({ ix: s.ix - 1 < 0 ? s.paths.length - 1 : s.ix - 1 }),
//   }

//   const view = ($: S, a: A) => h('div', [

//     ,Input({
//       value: $.val,
//       focus: $.focus && !$.pathMode,
//       icon: Icon.HardDrive,
//       desc: 'explorer',
//       change: a.change,
//       next: a.next,
//       prev: a.prev,
//       select: a.select,
//       jumpPrev: a.jumpPrev,
//       down: a.down,
//       up: a.up,
//       ctrlG: a.ctrlG,
//       ctrlH: a.ctrlH,
//       ctrlL: a.ctrlL,
//       ctrlC: a.closeWindow,
//     })

//     ,!$.pathMode && h(RowImportant, [
//       ,h('span', pathRelativeToHome($.path))
//     ])

//     ,$.pathMode && Input({
//       change: a.changePath,
//       hide: a.normalMode,
//       select: a.selectPath,
//       tab: a.completePath,
//       next: a.nextPath,
//       prev: a.prevPath,
//       value: pathRelativeToHome($.pathValue),
//       background: cvar('background-50'),
//       color: colors.important,
//       icon: Icon.Search,
//       desc: 'open path',
//       small: true,
//       focus: $.focus,
//       thisIsGarbage: (e: HTMLInputElement) => pathInputRef = e,
//       pathMode: true,
//     })

//     ,h('div', {
//       ref: (e: HTMLElement) => listElRef = e,
//       style: {
//         maxHeight: '50vh',
//         overflowY: 'hidden',
//       }
//     }, $.paths.map(({ name, dir }, ix) => h(RowNormal, {
//       key: `${name}-${dir}`,
//       active: ix === $.ix,
//     }, [
//       ,dir ? Folder : FiletypeIcon(name)

//       ,h('span', { style: { color: dir && ix !== $.ix ? cvar('foreground-50') : undefined } }, name)
//     ])))

//   ])

//   const element = document.createElement('div')
//   const ui = app<S, A>({ name: 'explorer-embed', state, actions, element, view })
//   return { element, ui }
// }

//registerShadowComponent(() => {
//  const { element, ui } = createComponent()

//  return {
//    element,
//    name: 'Explorer',
//    onShow: async () => {
//      const { cwd } = current
//      const paths = sortDirFiles(await getDirFiles(cwd))
//      ui.show({ cwd, paths, path: cwd })
//    },
//    // TODO: focus and blur should be called when the current buffer
//    // does not match the defined shadow buffer
//    //
//    // forgot what this means?
//    // i think maybe right now the events get triggered on ANY shadow buffer...
//    onFocus: ui.focus,
//    onBlur: ui.blur,
//  }
//})
