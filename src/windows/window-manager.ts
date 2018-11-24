import CreateWindow, { Window } from '../windows/window'
import { onSwitchVim, sessions } from '../core/sessions'
import { specs as titleSpecs } from '../core/title'
import getWindowMetadata from '../windows/metadata'
import { cursor, moveCursor } from '../core/cursor'
import CreateWebGLRenderer from '../render/webgl'
import { onElementResize } from '../ui/vanilla'
import { throttle } from '../support/utils'
import windowSizer from '../windows/sizer'

export const size = { width: 0, height: 0 }
export const webgl = CreateWebGLRenderer()
const windows = new Map<string, Window>()
const windowsById = new Map<string, Window>()
const state = { activeGrid: '', activeInstanceGrid: 1 }
const container = document.getElementById('windows') as HTMLElement
const webglContainer = document.getElementById('webgl') as HTMLElement

const superid = (id: number) => `i${sessions.current}-${id}`

const getWindowById = (windowId: number) => {
  const win = windowsById.get(superid(windowId))
  if (!win) throw new Error(`trying to get window that does not exist ${superid(windowId)}`)
  return win
}

const getInstanceWindows = (id = sessions.current) => [...windows.values()]
  .filter(win => win.id.startsWith(`i${id}`))

const refreshWebGLGrid = () => {
  webgl.clearAll()
  getInstanceWindows().forEach(w => w.redrawFromGridBuffer())
}

export const createWebGLView = () => webgl.createView()

export const setActiveGrid = (id: number) => Object.assign(state, {
  activeGrid: superid(id),
  activeInstanceGrid: id,
})


export const getActive = () => {
  const win = windows.get(state.activeGrid)
  if (!win) throw new Error(`trying to get window that does not exist ${state.activeGrid}`)
  return win
}

export const set = (id: number, gridId: number, row: number, col: number, width: number, height: number) => {
  const wid = superid(id)
  const gid = superid(gridId)
  const win = windows.get(gid) || CreateWindow()
  win.setWindowInfo({ id: wid, gridId: gid, row, col, width, height, visible: true })
  if (!windows.has(gid)) windows.set(gid, win)
  if (!windowsById.has(wid)) windowsById.set(wid, win)
  container.appendChild(win.element)
}

export const remove = (gridId: number) => {
  const win = windows.get(superid(gridId))
  if (!win) return console.warn(`trying to destroy a window that does not exist ${gridId}`)

  // redraw webgl first before removing DOM element
  // this helps a bit with flickering
  requestAnimationFrame(() => {
    if (container.contains(win.element)) container.removeChild(win.element)
    windowsById.delete(win.getWindowInfo().id)
    windows.delete(superid(gridId))
  })
}

export const get = (gridId: number) => {
  const win = windows.get(superid(gridId))
  if (!win) throw new Error(`trying to get window that does not exist ${superid(gridId)}`)
  return win
}

export const has = (gridId: number) => windows.has(superid(gridId))

export const layout = () => {
  const wininfos = getInstanceWindows().map(win => ({ ...win.getWindowInfo() }))
  const { gridTemplateRows, gridTemplateColumns, windowGridInfo } = windowSizer(wininfos)

  Object.assign(container.style, { gridTemplateRows, gridTemplateColumns })

  windowGridInfo.forEach(({ gridId, gridRow, gridColumn }) => {
    windows.get(gridId)!.applyGridStyle({ gridRow, gridColumn })
  })

  // wait for flex grid styles to be applied to all windows and trigger dom layout
  windowGridInfo.forEach(({ gridId }) => windows.get(gridId)!.refreshLayout())
  refreshWebGLGrid()

  // cursorline width does not always get resized correctly after window
  // layout changes, so we will force an update of the cursor to make sure
  // it is correct. test case: two vert splits, move to left and :bo
  state.activeGrid && requestAnimationFrame(() => {
    if (!windows.has(state.activeGrid)) return
    moveCursor(state.activeInstanceGrid, cursor.row, cursor.col)
  })
}

const updateWindowNameplates = () => requestAnimationFrame(async () => {
  const windowsWithMetadata = await getWindowMetadata()
  windowsWithMetadata.forEach(w => getWindowById(w.id).updateNameplate(w))
})

export const refresh = throttle(updateWindowNameplates, 5)

export const hide = (gridIds: number[][]) => gridIds.forEach(([gridId]) => get(gridId).hide())

export const pixelPosition = (row: number, col: number) => {
  const win = windows.get(state.activeGrid)
  if (win) return win.positionToWorkspacePixels(row, col)
  console.warn('no active window grid... hmmm *twisty effect*')
  return { x: 0, y: 0 }
}

webgl.backgroundElement.setAttribute('wat', 'webgl-background')
webgl.foregroundElement.setAttribute('wat', 'webgl-foreground')

Object.assign(webglContainer.style, {
  width: '100vw',
  // TODO: 24px for statusline. do it better
  // TODO: and title. bruv do i even know css?
  height: `calc(100vh - 24px - ${titleSpecs.height}px)`,
  flex: 1,
  zIndex: 2,
  position: 'absolute',
  background: 'var(--background)',
})

Object.assign(container.style, {
  width: '100vw',
  // TODO: 24px for statusline. do it better
  // TODO: and title. bruv do i even know css?
  height: `calc(100vh - 24px - ${titleSpecs.height}px)`,
  position: 'absolute',
  flex: 1,
  zIndex: 5,
  display: 'grid',
  justifyItems: 'stretch',
  alignItems: 'stretch',
  background: 'none',
})

Object.assign(webgl.backgroundElement.style, {
  position: 'absolute',
  zIndex: 3,
})

Object.assign(webgl.foregroundElement.style, {
  position: 'absolute',
  zIndex: 4,
})

webglContainer.appendChild(webgl.backgroundElement)
webglContainer.appendChild(webgl.foregroundElement)

onElementResize(webglContainer, (w, h) => {
  Object.assign(size, { width: w, height: h })
  webgl.resizeCanvas(w, h)
  getInstanceWindows().forEach(w => {
    w.refreshLayout()
    w.redrawFromGridBuffer()
  })
})

onSwitchVim((id, lastId) => {
  getInstanceWindows(lastId).forEach(w => w.maybeHide())
  getInstanceWindows(id).forEach(w => w.maybeShow())
  const wininfos = getInstanceWindows(id).map(w => ({ ...w.getWindowInfo() }))
  const { gridTemplateRows, gridTemplateColumns } = windowSizer(wininfos)
  Object.assign(container.style, { gridTemplateRows, gridTemplateColumns })
})
