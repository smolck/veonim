import * as vsc from 'vscode'

export default (name: string): vsc.OutputChannel => ({
  name,
  append: (value) => console.log(`OC {${name}} -> ${value}`),
  appendLine: (value) => console.log(`OC {${name}} -> ${value}`),
  clear: () => {},
  show: () => {},
  hide: () => {},
  dispose: () => {},
})
