import { Range } from 'vscode-languageserver-protocol'
import { pascalCase, onProp } from '../support/utils'

type DefineFunction = { [index: string]: (fnBody: TemplateStringsArray, ...vars: any[]) => void }

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
