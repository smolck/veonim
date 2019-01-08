import { onSwitchVim, instances } from '../core/instance-manager'
import CreateWindow, { Window } from '../windows/window'
import { cursor, moveCursor } from '../core/cursor'
import CreateWebGLRenderer from '../render/webgl'
import { onElementResize } from '../ui/vanilla'
import { throttle } from '../support/utils'
import windowSizer from '../windows/sizer'
import api from '../core/instance-api'

export const size = { width: 0, height: 0 }
export const webgl = CreateWebGLRenderer()
const windows = new Map<string, Window>()
const windowsById = new Map<string, Window>()
const unpositionedWindows = new Set<string>()
const state = { activeGrid: '', activeInstanceGrid: 1 }
const container = document.getElementById('windows') as HTMLElement
const webglContainer = document.getElementById('webgl') as HTMLElement

const superid = (id: number) => `i${instances.current}-${id}`

const getWindowById = (windowId: number) => {
  const win = windowsById.get(superid(windowId))
  if (!win) throw new Error(`trying to get window that does not exist ${superid(windowId)}`)
  return win
}

const getInstanceWindows = (id = instances.current) => [...windows.values()]
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
  // we only want to add grids that have valid window positions
  // this happens rarely and i think it might be a nvim bug?
  if (id < 0) return unpositionedWindows.add(gid)
  container.appendChild(win.element)
  unpositionedWindows.delete(gid)
}

// i made the assumption that a grid_resize event was always going to follow up
// with a win_pos event. i think however there are grids that never get
// positioned, so we need to make sure they do not get rendered
export const disposeUnpositionedWindows = () => {
  unpositionedWindows.forEach(gid => {
    const win = windows.get(gid)
    if (!win) throw new Error(`window grid does not exist ${gid}`)
    windows.delete(gid)
    windowsById.delete(win.id)
    unpositionedWindows.delete(gid)
  })

  unpositionedWindows.delete(superid(-1))
}

export const remove = (gridId: number) => {
  const win = windows.get(superid(gridId))
  if (!win) return console.warn(`trying to destroy a window that does not exist ${gridId}`)

  // redraw webgl first before removing DOM element
  // this helps a bit with flickering
  requestAnimationFrame(() => {
    win.element.remove()
    // if (container.contains(win.element)) container.removeChild(win.element)
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
  const windowsWithMetadata = await api.getWindowMetadata()
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
  position: 'absolute',
  width: '100%',
  height: '100%',
  flex: 1,
  zIndex: 2,
  background: 'var(--background)',
})

Object.assign(container.style, {
  position: 'absolute',
  width: '100%',
  height: '100%',
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

api.nvim.watchState.colorscheme(() => {
  webgl.clearAll()
  getInstanceWindows().forEach(w => w.redrawFromGridBuffer())
})
