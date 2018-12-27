import * as vsc from 'vscode'
import { hostname } from 'os'

const env: typeof vsc.env = {
  appName: 'Veonim',
  appRoot: process.cwd(),
  language: 'en-US',
  machineId: hostname(),
  sessionId: `Veonim-${Date.now()}`,
  // TODO; electron not available in web worker. need to bridge back to main thread
  // clipboard: {
  //   readText: async () => clipboard.readText(),
  //   writeText: async value => clipboard.writeText(value),
  // }
}

export default env
