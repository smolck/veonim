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

// TODO: i don't remember why we had to fake out this module
// but it looks like extensions bring in vscode-languageclient via
// npm package. so we should just let extensions use the real thing

// because we have a number of extensions right now that do not
// bring in the 'vscode-languageclient' dependency via npm, we will
// maintain backwards compatibility by trying to load the real thing
// and then falling back to our shim.
//
// we should patch the extensions and remove this shim
fakeModule('vscode-languageclient', {
  LanguageClient,
}, logMissingModuleApiDuringDevelopment)
