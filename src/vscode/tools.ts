import { vscLanguageToFiletypes } from '../langserv/vsc-languages'
import { EventEmitter } from 'events'
import { is } from '../support/utils'
import * as vsc from 'vscode'

const cancelTokens = new EventEmitter()

export const cancelTokenById = (id: string) => cancelTokens.emit(id)

export const makeCancelToken = (id: string): vsc.CancellationTokenSource => {
  const onCancelFns = new Set()

  const token: vsc.CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: (fn: any) => {
      onCancelFns.add(fn)
      return { dispose: () => onCancelFns.delete(fn) }
    },
  }

  const cancel = () => {
    token.isCancellationRequested = true
    onCancelFns.forEach(fn => fn())
    dispose()
  }

  const dispose = () => {
    onCancelFns.clear()
    cancelTokens.removeAllListeners(id)
  }

  cancelTokens.once(id, cancel)

  return { token, cancel, dispose }
}

const parseDocumentFilter = (filter: vsc.DocumentFilter): string[] => {
  if (filter.language) return vscLanguageToFiletypes(filter.language)
  return []
  // TODO: for day 1 document selectors will support only filetypes since nvim
  // easily supports filetypes out of the box. in the future we can get more
  // fancy and support DocumentFilter.pattern glob patterns. also looking to see
  // what kind of usecases there are for such rich document selectors
}

export const selectorToFiletypes = (selector: vsc.DocumentSelector): string[] => {
  const selectors = is.array(selector) ? selector : [ selector ]

  return (selectors as Array<vsc.DocumentFilter | string>).reduce((res, sel) => {
    if (is.string(sel)) return [ ...res, ...vscLanguageToFiletypes(sel as string) ]
    if (is.object(sel)) return [ ...res, ...parseDocumentFilter(sel as vsc.DocumentFilter) ]
    return res
  }, [] as string[])
}
