import { clipboard } from 'electron'
import * as vsc from 'vscode'
import { hostname } from 'os'

const env: typeof vsc.env = {
  appName: 'Veonim',
  appRoot: process.cwd(),
  language: 'en-US',
  machineId: hostname(),
  sessionId: `Veonim-${Date.now()}`,
  clipboard: {
    readText: async () => clipboard.readText(),
    writeText: async value => clipboard.writeText(value),
  }
}

export default env
