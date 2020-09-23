import fakeModule from '../support/fake-module'
import vscode from '../vscode/api'

type LogMissingModuleApi = (moduleName: string, apiPath: string) => void
let logMissingModuleApiDuringDevelopment: LogMissingModuleApi = () => {}

if (process.env.VEONIM_DEV) {
  logMissingModuleApiDuringDevelopment = (moduleName, apiPath) =>
    console.warn(
      `fake module ${moduleName} is missing an implementation for: ${apiPath}`
    )
}

fakeModule('vscode', vscode, logMissingModuleApiDuringDevelopment)
