import fakeModule from '../support/fake-module'
import vscode from '../vscode/api'

type LogMissingModuleApi = (moduleName: string, apiPath: string) => void
  let logMissingModuleApiDuringDevelopment: LogMissingModuleApi = () => {}

if (process.env.VEONIM_DEV) {
  logMissingModuleApiDuringDevelopment = (moduleName, apiPath) => console.warn(`fake module ${moduleName} is missing an implementation for: ${apiPath}`)
}

const LanguageClient = class LanguageClient {
  protected name: string
  protected serverActivator: Function

  constructor (name: string, serverActivator: Function) {
    this.name = name
    this.serverActivator = serverActivator
  }

  start () {
    console.log('starting extension:', this.name)
    return this.serverActivator()
  }

  error (...data: any[]) {
    console.error(this.name, ...data)
  }
}

fakeModule('vscode', vscode, logMissingModuleApiDuringDevelopment)

fakeModule('vscode-languageclient', {
  LanguageClient,
}, logMissingModuleApiDuringDevelopment)
