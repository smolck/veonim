import * as windows from '../windows/window-manager'
import { genList } from '../support/utils'
import { stealInput } from '../core/input'
import { cursor } from '../core/cursor'
import { makel } from '../ui/vanilla'
import { paddingV } from '../ui/css'
// import * as grid from '../core/grid'
import nvim from '../core/neovim'

// interface CellPosition {
//   row: number
//   col: number
// }

// interface FindPosOpts {
//   row: number
//   col: number
//   height: number
//   width: number
//   paddingX: number
//   paddingY: number
//   fg?: string
//   bg?: string
// }

// hand crafted for maximum ergonomic comfort
const labels = {
  single: ['A', 'S', 'D', 'F', 'J', 'K', 'L', 'G', 'H', 'W', 'E', 'R', 'I', 'O', 'Q', 'T', 'U', 'P', 'N', 'M', 'V', 'B', 'C'],
  double: [
    'AJ', 'AK', 'AL', 'AH', 'AN', 'AI', 'AO', 'AU', 'AP', 'AM', 'AS', 'AD', 'AF', 'AG', 'AE', 'AR', 'AW', 'AT', 'AV',
    'SJ', 'SK', 'SL', 'SH', 'SN', 'SI', 'SO', 'SU', 'SP', 'SM', 'SA', 'SD', 'SF', 'SG', 'SE', 'SR',
    'DJ', 'DK', 'DL', 'DH', 'DN', 'DI', 'DO', 'DU', 'DP', 'DM', 'DA', 'DS', 'DF', 'DG', 'DW', 'DQ', 'DE', 'DV',
    'FJ', 'FK', 'FL', 'FH', 'FN', 'FI', 'FO', 'FU', 'FP', 'FM', 'FA', 'FS', 'FD', 'FE', 'FW', 'FQ',
    'EJ', 'EK', 'EL', 'EH', 'EN', 'EI', 'EO', 'EU', 'EP', 'EM', 'EF', 'EG', 'ER', 'ET', 'EW', 'EQ', 'EA', 'ES', 'EV',
    'RJ', 'RK', 'RL', 'RH', 'RN', 'RI', 'RO', 'RU', 'RP', 'RM', 'RA', 'RS', 'RE', 'RW', 'RQ', 'RG',
    'WJ', 'WK', 'WL', 'WH', 'WN', 'WI', 'WO', 'WU', 'WP', 'WM', 'WA', 'WD', 'WF', 'WE', 'WR', 'WT', 'WG', 'WV',
    'QJ', 'QK', 'QL', 'QH', 'QN', 'QI', 'QO', 'QU', 'QP', 'QM', 'QD', 'QF', 'QW', 'QE', 'QR', 'QT', 'QG',
    'GJ', 'GK', 'GL', 'GH', 'GN', 'GI', 'GO', 'GU', 'GP', 'GM', 'GD', 'GS', 'GA', 'GE', 'GW', 'GQ',
    'JA', 'JS', 'JD', 'JF', 'JG', 'JE', 'JR', 'JW', 'JQ', 'JK', 'JL', 'JI', 'JO', 'JP', 'JV',
    'KA', 'KS', 'KD', 'KF', 'KG', 'KE', 'KR', 'KW', 'KQ', 'KJ', 'KL', 'KN', 'KO', 'KP', 'KV',
    'LA', 'LS', 'LD', 'LF', 'LG', 'LE', 'LR', 'LW', 'LQ', 'LJ', 'LK', 'LN', 'LI', 'LU', 'LV',
    'HA', 'HS', 'HD', 'HF', 'HG', 'HE', 'HR', 'HW', 'HQ', 'HJ', 'HL', 'HI', 'HO', 'HP', 'HV',
    'NA', 'NS', 'ND', 'NF', 'NG', 'NE', 'NR', 'NW', 'NQ', 'NK', 'NL', 'NI', 'NO', 'NP', 'NV',
    'IA', 'IS', 'ID', 'IF', 'IG', 'IE', 'IR', 'IW', 'IQ', 'IJ', 'IL', 'IN', 'IH', 'IO', 'IP', 'IV',
    'OA', 'OS', 'OD', 'OF', 'OG', 'OE', 'OR', 'OW', 'OQ', 'OJ', 'OK', 'OH', 'OI', 'ON', 'OP', 'OV',
    'PA', 'PS', 'PD', 'PF', 'PG', 'PE', 'PR', 'PW', 'PQ', 'PJ', 'PK', 'PH', 'PI', 'PN', 'PO', 'PV',
    'MA', 'MS', 'MD', 'MF', 'MG', 'ME', 'MR', 'MW', 'MQ', 'MK', 'ML', 'MI', 'MO', 'MP', 'MV',
    'VJ', 'VK', 'VL', 'VH', 'VN', 'VI', 'VO', 'VP', 'VU', 'VM', 'VA', 'VS', 'VD', 'VE', 'VR', 'VW', 'VQ',
    'UA', 'US', 'UD', 'UF', 'UG', 'UE', 'UR', 'UW', 'UQ', 'UH', 'UL', 'UI', 'UP', 'UN', 'UV',
    'TJ', 'TK', 'TL', 'TH', 'TN', 'TI', 'TO', 'TP', 'TU', 'TM', 'TA', 'TE', 'TW', 'TQ', 'TR',
  ],
}

const singleLabelLimit = labels.single.length

const getLabels = (itemCount: number) => {
  const doubleSize = itemCount > singleLabelLimit
  return {
    labelSize: doubleSize ? 2 : 1,
    getLabel: (index: number) => doubleSize
      ? labels.double[index]
      : labels.single[index],
    // TODO: would it be faster to use a map? only lookup instead of find
    indexOfLabel: (label: string) => doubleSize
      ? labels.double.indexOf(label)
      : labels.single.indexOf(label),
  }
}

const labelHTML = (label: string) => label
  .split('')
  // using margin-right instead of letter-spacing because letter-spacing adds space
  // to the right of the last letter - so it ends up with more padding on the right :/
  .map((char, ix) => `<span${!ix ? ' style="margin-right: 2px"': ''}>${char}</span>`)
  .join('')

const divinationLine = async ({ visual }: { visual: boolean }) => {
  if (visual) nvim.feedkeys('gv', 'n')
  else nvim.feedkeys('m`', 'n')

  const win = windows.getActive()
  const rowPositions = genList(win.rows, row => win.editor.positionToEditorPixels(row, 0))
  const labelContainer = makel({ position: 'absolute' })
  const { labelSize, getLabel, indexOfLabel } = getLabels(rowPositions.length)

  const labels = rowPositions.map(({ y }, ix) => {
    const el = makel({
      ...paddingV(4),
      position: 'absolute',
      fontSize: '1.1rem',
      top: `${y}px`,
      background: '#000',
      marginTop: '-1px',
      color: '#eee',
    })

    el.innerHTML = labelHTML(getLabel(ix))
    return el
  })

  labels
    .filter((_, ix) => ix !== cursor.row)
    .forEach(label => labelContainer.appendChild(label))

  const overlay = win.addOverlayElement(labelContainer)

  const updateLabels = (matchChar: string) => labels
    .filter(m => (m.children[0] as HTMLElement).innerText.toLowerCase() === matchChar)
    .forEach(m => Object.assign((m.children[0] as HTMLElement).style, {
      // TODO: inherit from colorscheme
      color: '#ff007c'
    }))

  const grabbedKeys: string[] = []

  const reset = () => {
    restoreInput()
    overlay.remove()
  }

  const jump = () => {
    const jumpLabel = grabbedKeys.join('').toUpperCase()
    const targetRow = indexOfLabel(jumpLabel)
    if (targetRow === -1) return reset()

    const jumpDistance = targetRow - cursor.row
    const jumpMotion = jumpDistance > 0 ? 'j' : 'k'
    const cursorAdjustment = visual
      ? jumpDistance > 0 ? 'g$' : ''
      : 'g^'

    const command = `${Math.abs(jumpDistance)}g${jumpMotion}${cursorAdjustment}`
    nvim.feedkeys(command, 'n')
    reset()
  }

  const restoreInput = stealInput(keys => {
    if (keys === '<Esc>') return reset()

    grabbedKeys.push(keys)
    if (labelSize === 1 && grabbedKeys.length === 1) return jump()
    if (labelSize === 2 && grabbedKeys.length === 1) return updateLabels(keys)
    if (labelSize === 2 && grabbedKeys.length === 2) return jump()
    else reset()
  })
}

// const findSearchPositions = ({ row, col, height, width, bg }: FindPosOpts) => {
//   const maxRow = row + height
//   const maxCol = col + width

//   let lastCellWasARegularCell = true
//   const searchPositions: CellPosition[] = []

//   for (let rowIx = row; rowIx < maxRow; rowIx++) {
//     for (let colIx = col; colIx < maxCol; colIx++) {
//       const [ /*char*/, /*cellFg*/, cellBg ] = grid.get(rowIx, colIx)
//       // TODO: don't know if this will ever be good with trying
//       // to match search highlights from color information noly
//       // ( see below for more comments )
//       const isSearchCell = cellBg === bg
//       // const isSearchCell = cellFg === fg && cellBg === bg 

//       if (lastCellWasARegularCell && isSearchCell) {
//         searchPositions.push({ row: rowIx, col: colIx })
//         lastCellWasARegularCell = false
//       }

//       if (!isSearchCell) lastCellWasARegularCell = true
//     }
//   }

//   return searchPositions
// }

export const divinationSearch = async () => {
  // const win = activeWindow()
  // if (!win) throw new Error('no window found for divination purposes lol wtf')

  // const { foreground, background } = await nvim.getColor('Search')
  // const specs = win.getSpecs()
  // const cursorDistanceFromTopOfEditor = cursor.row - specs.row
  // const cursorDistanceFromLeftOfEditor = cursor.col - specs.col

  // const searchPositions = findSearchPositions({
  //   ...specs,
  //   // TODO: this is a real shit way of doing it. getColor returns
  //   // us the color defined in the colorscheme. color can be reversed
  //   // but we don't know if it is reversed or not and how to compare.
  //   // also if we specify a color as NONE, getColor will return
  //   // some default value (#000 observed) but the rendered color
  //   // inherits the color from somewhere else

  //   // background and foreground are swapped in vim colorscheme
  //   // for Search highlight group (because of gui=reverse)
  //   fg: background,
  //   bg: foreground,
  // })

  // if (!searchPositions.length) return

  // // TODO: again, same issue as above, remove/filter out the current line + col
  // // if mouse is right on top of it
  // const searchPixelPositions = searchPositions.map(m => ({
  //   ...m,
  //   ...win.relativePositionToPixels(m.row, m.col),
  // }))

  // const labelContainer = makel({ position: 'absolute' })
  // const jumpTargets = new Map()

  // const { labelSize, getLabel } = getLabels(searchPixelPositions.length)

  // const labels = searchPixelPositions.map((pos, ix) => {
  //   const relativePosition = {
  //     row: pos.row - specs.row,
  //     col: pos.col - specs.col,
  //   }

  //   const sameRow = relativePosition.row === cursorDistanceFromTopOfEditor
  //   const sameCol = relativePosition.col === cursorDistanceFromLeftOfEditor

  //   if (sameRow && sameCol) return

  //   // TODO: these styles should be shared. also i think we should use css translate
  //   // instead of top/left
  //   const el = makel({
  //     ...paddingV(4),
  //     position: 'absolute',
  //     // TODO: this font-size depends on global font-size + line-height
  //     // may need to figure out a good way to determine the largest font-size
  //     // that we can display without overlapping!
  //     fontSize: '1.3rem',
  //     // TODO: need to figure out what to do when labels stack on top of each other???
  //     // like if two chars are highlighted right next to each other <2 spaces
  //     top: `${pos.y}px`,
  //     left: `${pos.x}px`,
  //     background: '#000',
  //     color: '#eee',
  //   })

  //   const label = getLabel(ix)
  //   jumpTargets.set(label, relativePosition)
  //   el.innerHTML = labelHTML(label)

  //   return el
  // }).filter(m => m) as HTMLElement[]

  // labels.forEach(label => labelContainer.appendChild(label))
  // currentWindowElement.add(labelContainer)

  // const updateLabels = (matchChar: string) => labels
  //   .filter(m => (m.children[0] as HTMLElement).innerText.toLowerCase() === matchChar)
  //   .forEach(m => merge((m.children[0] as HTMLElement).style, {
  //     // TODO: inherit from colorscheme
  //     color: '#ff007c'
  //   }))

  // hideCursor()
  // const grabbedKeys: string[] = []

  // const reset = () => {
  //   restoreInput()
  //   currentWindowElement.remove(labelContainer)
  //   showCursor()
  // }

  // const jump = async () => {
  //   const jumpLabel = grabbedKeys.join('').toUpperCase()
  //   if (!jumpTargets.has(jumpLabel)) return reset()

  //   const { row, col } = jumpTargets.get(jumpLabel)

  //   const jumpDistance = row - cursorDistanceFromTopOfEditor
  //   const jumpMotion = jumpDistance > 0 ? 'j' : 'k'
  //   const command = `m\`${Math.abs(jumpDistance)}g${jumpMotion}${col + 1}|`

  //   nvim.feedkeys(command, 'n')
  //   reset()
  // }

  // const restoreInput = stealInput(keys => {
  //   if (keys === '<Esc>') return reset()

  //   grabbedKeys.push(keys)
  //   if (labelSize === 1 && grabbedKeys.length === 1) return jump()
  //   if (labelSize === 2 && grabbedKeys.length === 1) return updateLabels(keys)
  //   if (labelSize === 2 && grabbedKeys.length === 2) return jump()
  //   else reset()
  // })
}

nvim.onAction('jump-search', divinationSearch)
nvim.onAction('jump-line', () => divinationLine({ visual: false }))
nvim.onAction('jump-line-visual', () => divinationLine({ visual: true }))
