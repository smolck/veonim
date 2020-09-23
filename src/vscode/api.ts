import {
  TextEditorCursorStyle,
  OverviewRulerLane,
  IndentAction,
} from '../vscode/enums'
import { CancellationTokenSource } from '../vscode/cancellation'
import { Emitter as EventEmitter } from '../vscode/event'
import packageInfo from '../support/package-info'
import * as vscodeTypes from '../vscode/types'
import extensions from '../vscode/extensions'
import languages from '../vscode/languages'
import workspace from '../vscode/workspace'
import { URI as Uri } from '../vscode/uri'
import commands from '../vscode/commands'
import window from '../vscode/window'
import debug from '../vscode/debug'
import tasks from '../vscode/tasks'
import scm from '../vscode/scm'
import env from '../vscode/env'
import * as vsc from 'vscode'

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

const api: typeof vsc = {
  version: packageInfo['vscode-api-version'],
  ...vscodeTypes,
  CancellationTokenSource,
  TextEditorCursorStyle,
  OverviewRulerLane,
  EventEmitter,
  IndentAction,
  extensions,
  languages,
  workspace,
  FileType,
  commands,
  window,
  debug,
  tasks,
  Uri,
  scm,
  env,
}

export default api
