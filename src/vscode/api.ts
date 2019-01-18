import * as vscodeTypes from '../vscode/types'
import extensions from '../vscode/extensions'
import languages from '../vscode/languages'
import workspace from '../vscode/workspace'
import commands from '../vscode/commands'
import window from '../vscode/window'
import debug from '../vscode/debug'
import tasks from '../vscode/tasks'
import scm from '../vscode/scm'
import env from '../vscode/env'
import { URI } from '../vscode/uri'

export default {
  Uri: URI,
  ...vscodeTypes,
  extensions,
  languages,
  workspace,
  commands,
  window,
  debug,
  tasks,
  scm,
  env,
}
