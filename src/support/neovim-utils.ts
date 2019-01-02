// TODO: this file might be better if it lived under src/neovim
import { delay, pascalCase, onProp } from '../support/utils'
import { Range } from 'vscode-languageserver-protocol'
import { VimMode } from '../neovim/types'
import { Api } from '../neovim/protocol'

type DefineFunction = { [index: string]: (fnBody: TemplateStringsArray, ...vars: any[]) => void }

interface VimState {
  blocking: boolean,
  mode: string,
}

// TODO: this getMode/blocking/input/capture :messages is kinda hack.
// when neovim implements external dialogs, please revisit
const unblock = (notify: Api, request: Api) => (): Promise<string[]> => new Promise(fin => {
  let neverGonnaGiveYouUp = false
  const typescript_y_u_do_dis = (): Promise<VimState> => request.getMode() as Promise<VimState>

  const timer = setTimeout(() => {
    neverGonnaGiveYouUp = true // never gonna let you down
    fin([])
  }, 2e3)

  const tryToUnblock = () => typescript_y_u_do_dis().then(mode => {
    if (!mode.blocking) {
      Promise.race([
        request.commandOutput('messages').then(m => m.split('\n').filter(m => m)),
        delay(250).then(() => [])
      ]).then(fin)

      clearInterval(timer)
      return
    }

    notify.input(`<Enter>`)
    if (!neverGonnaGiveYouUp) setImmediate(() => tryToUnblock())
  })

  tryToUnblock()
})

export default ({ notify, request }: { notify: Api, request: Api }) => ({
  unblock: unblock(notify, request)
})

export const FunctionGroup = () => {
  const fns: string[] = []

  const defineFunc: DefineFunction = onProp((name: PropertyKey) => (strParts: TemplateStringsArray, ...vars: any[]) => {
    const expr = strParts
      .map((m, ix) => [m, vars[ix]].join(''))
      .join('')
      .split('\n')
      .filter(m => m)
      .map(m => m.trim())
      .join('\\n')
      .replace(/"/g, '\\"')

    fns.push(`exe ":fun! ${pascalCase(name as string)}(...) range\\n${expr}\\nendfun"`)
  })

  return {
    defineFunc,
    getFunctionsAsString: () => fns.join(' | '),
  }
}

export const CmdGroup = (strParts: TemplateStringsArray, ...vars: any[]) => strParts
  .map((m, ix) => [m, vars[ix]].join(''))
  .join('')
  .split('\n')
  .filter(m => m)
  .map(m => m.trim())
  .map(m => m.replace(/\|/g, '\\|'))
  .join(' | ')
  .replace(/"/g, '\\"')

export const positionWithinRange = (line: number, column: number, { start, end }: Range): boolean => {
  const startInRange = line >= start.line
    && (line !== start.line || column >= start.character)

  const endInRange = line <= end.line
    && (line !== end.line || column <= end.character)

  return startInRange && endInRange
}

export const normalizeVimMode = (mode: string): VimMode => {
  if (mode === 't') return VimMode.Terminal
  if (mode === 'n' || mode === 'normal') return VimMode.Normal
  if (mode === 'i' || mode === 'insert') return VimMode.Insert
  if (mode === 'V' || mode === 'visual') return VimMode.Visual
  if (mode === 'R' || mode === 'replace') return VimMode.Replace
  if (mode === 'no' || mode === 'operator') return VimMode.Operator
  if (mode === 'c' || mode === 'cmdline_normal') return VimMode.CommandNormal
  if (mode === 'cmdline_insert') return VimMode.CommandInsert
  if (mode === 'cmdline_replace') return VimMode.CommandReplace
  // there are quite a few more modes available. see `mode_info_set`
  else return VimMode.SomeModeThatIProbablyDontCareAbout
}
