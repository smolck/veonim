import { call, request } from '../messaging/worker-client'
import * as vsc from 'vscode'
import { hostname } from 'os'

const env: typeof vsc.env = {
  appName: 'Veonim',
  appRoot: process.cwd(),
  language: 'en-US',
  machineId: hostname(),
  sessionId: `Veonim-${Date.now()}`,
  clipboard: {
    readText: async () => request.clipboardRead(),
    writeText: async value => call.clipboardWrite(value),
  }
}

export default env
