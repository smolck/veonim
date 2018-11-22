import { createWebGLView, size as windowsGridSize } from '../windows/window-manager'
import CreateWindowNameplate, { NameplateState } from '../windows/nameplate'
import { getCharFromIndex } from '../render/font-texture-atlas'
import { specs as titleSpecs } from '../core/title'
import { cell } from '../core/canvas-container'
import { WebGLView } from '../render/webgl'
import { makel } from '../ui/vanilla'

export interface WindowInfo {
  id: number
  gridId: number
  row: number
  col: number
  width: number
  height: number
  visible: boolean
}

interface GridStyle {
  gridRow: string
  gridColumn: string
}

interface Position {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

export interface WindowOverlay {
  remove(): void
  move(row: number, col: number): void
}

export interface Window {
  webgl: WebGLView
  element: HTMLElement
  getWindowInfo(): WindowInfo
  setWindowInfo(info: WindowInfo): void
  applyGridStyle(gridStyle: GridStyle): void
  refreshLayout(): void
  hide(): void
  redrawFromGridBuffer(): void
  getCharAt(row: number, col: number): string
  updateNameplate(data: NameplateState): void
  addOverlayElement(element: HTMLElement): WindowOverlay
  removeOverlayElement(element: HTMLElement): void
  gridToPixelPosition(row: number, col: number): Position
  getWindowSize(): Size
  resizeWindow(width: number, height: number): void
}

const edgeDetection = (el: HTMLElement) => {
  const { top, left, bottom, right } = el.getBoundingClientRect()
  const edges = Object.create(null)
  if (left === 0) edges.borderLeft = 'none'
  if (top === titleSpecs.height) edges.borderTop = 'none'
  if (bottom - titleSpecs.height === windowsGridSize.height) edges.borderBottom = 'none'
  if (right === windowsGridSize.width) edges.borderRight = 'none'
  return edges
}

export default () => {
  const wininfo: WindowInfo = { id: 0, gridId: 0, row: 0, col: 0, width: 0, height: 0, visible: true }
  const layout = { x: 0, y: 0, width: 0, height: 0 }
  const webgl = createWebGLView()

  const container = makel({
    flexFlow: 'column',
    background: 'none',
    display: 'flex',
  })

  const content = makel({
    display: 'flex',
    flex: 1,
    background: 'none',
  })

  const overlay = makel({
    display: 'flex',
    position: 'absolute',
  })

  const nameplate = CreateWindowNameplate()

  overlay.setAttribute('wat', 'overlay')
  content.setAttribute('wat', 'content')
  nameplate.element.setAttribute('wat', 'nameplate')

  Object.assign(nameplate.element.style, {
    background: 'var(--background-30)',
  })

  content.appendChild(overlay)
  container.appendChild(nameplate.element)
  container.appendChild(content)

  const api = {
    get webgl() { return webgl },
    get element() { return container },
  } as Window

  api.resizeWindow = (width, height) => {
    webgl.resize(height, width)
  }

  api.setWindowInfo = info => {
    if (!wininfo.visible) {
      container.style.display = 'flex'
      webgl.renderGridBuffer()
    }

    container.id = `${info.id}`
    Object.assign(wininfo, info)
  }

  api.getWindowInfo = () => ({ ...wininfo })

  api.gridToPixelPosition = (row, col) => {
    const winX = Math.floor(col * cell.width)
    const winY = Math.floor(row * cell.height)
    return {
      x: layout.x + winX,
      y: layout.y + winY,
    }
  }

  api.getWindowSize = () => ({
    width: layout.width,
    height: layout.height,
  })

  api.applyGridStyle = ({ gridRow, gridColumn }) => {
    Object.assign(container.style, { gridColumn, gridRow })
  }

  api.hide = () => {
    wininfo.visible = false
    container.style.display = 'none'
    webgl.clear()
  }

  api.refreshLayout = () => {
    const { top, left, width, height } = content.getBoundingClientRect()

    const x = left
    const y = top - titleSpecs.height

    const same = layout.x === x
      && layout.y === y
      && layout.width === width
      && layout.height === height

    if (same) return

    Object.assign(layout, { x, y, width, height })
    webgl.layout(x, y, width, height)

    Object.assign(container.style, {
      border: '1px solid var(--background-30)',
    }, edgeDetection(container))
  }

  // TODO: add api to control row/col position of this overlay element?
  api.addOverlayElement = element => {
    overlay.appendChild(element)
    return {
      remove: () => overlay.removeChild(element),
      move: (row: number, col: number) => {
        // TODO: i like to move it move it
        console.warn('NYI: overlay element move', row, col)
      }
    }
  }

  api.redrawFromGridBuffer = () => webgl.renderGridBuffer()

  api.getCharAt = (row, col) => {
    const buf = webgl.getGridCell(row, col)
    return getCharFromIndex(buf[3] || 0)
  }

  api.updateNameplate = data => nameplate.update(data)

  return api
}
