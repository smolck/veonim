import { discoverCompletions, getCompletionDetail } from '../ai/completions'
import { getSignatureHint } from '../ai/signature-hint'
import { call, on } from '../messaging/worker-client'
import { getWorkspaceSymbols } from '../ai/symbols'
import { runCodeAction } from '../ai/diagnostics'
import colorizer from '../services/colorizer'
import { AI } from '../ai/protocol'
import nvim from '../neovim/api'
import '../ai/type-definition'
import '../ai/implementation'
import '../ai/references'
import '../ai/definition'
import '../ai/highlights'
import '../ai/rename'
import '../ai/hover'

let completionEnabled = true
nvim.watchState.colorscheme((color: string) =>
  colorizer.call.setColorScheme(color)
)
nvim.getOptionCurrentAndFuture(
  'completefunc',
  (func) => (completionEnabled = func === 'VeonimComplete')
)

nvim.on.cursorMoveInsert(async () => {
  // tried to get the line contents from the render grid buffer, but it appears
  // this autocmd gets fired before the grid gets updated from the render event.
  // once we add a setImmediate to wait for render pass, we're back to the same
  // amount of time it took to simply query nvim with 'get_current_line'
  //
  // if we used the nvim notification for mode change, we could send events after
  // a render pass. this event would then contain both the current window grid
  // contents + current vim mode. we could then easily improve this action here
  // and perhaps others in the app
  const lineContent = await nvim.getCurrentLine()
  if (completionEnabled)
    discoverCompletions(lineContent, nvim.state.line, nvim.state.column)
  getSignatureHint(lineContent)
})

on.aiGetCompletionDetail(getCompletionDetail)
on.aiGetWorkspaceSymbols(getWorkspaceSymbols)
on.aiRunCodeAction(runCodeAction)

export const ui: AI = new Proxy(Object.create(null), {
  get: (_: any, namespace: string) =>
    new Proxy(Object.create(null), {
      get: (_: any, method: string) => (...args: any[]) =>
        call.ai(namespace, method, args),
    }),
})
