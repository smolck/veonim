import { SignatureInformation, MarkupContent, MarkupKind } from 'vscode-languageserver-protocol'
import { supports, getTriggerChars } from '../langserv/server-features'
import { markdownToHTML } from '../support/markdown'
import { signatureHelp } from '../langserv/adapter'
import { merge } from '../support/utils'
import { cursor } from '../core/cursor'
import { ui } from '../components/hint'
import nvim from '../neovim/api'

const cache = {
  signatures: [] as SignatureInformation[],
  selectedSignature: 0,
  totalParams: 0,
  currentParam: 0,
}

const shouldCloseSignatureHint = (totalParams: number, currentParam: number, triggers: Set<string>, leftChar: string): boolean => {
  if (currentParam < totalParams - 1) return false

  const matching = triggers.has('(') || triggers.has('{') || triggers.has('[')
  if (!matching) return true

  return (leftChar === ')' && triggers.has('('))
    || (leftChar === '}' && triggers.has('{'))
    || (leftChar === ']' && triggers.has('['))
}

const cursorPos = () => ({ row: cursor.row, col: cursor.col })

const parseDocs = async (docs?: string | MarkupContent): Promise<string | undefined> => {
  if (!docs) return

  if (typeof docs === 'string') return docs
  if (docs.kind === MarkupKind.PlainText) return docs.value
  return markdownToHTML(docs.value)
}

const showSignature = async (signatures: SignatureInformation[], which?: number | null, param?: number | null) => {
  const { label = '', documentation = '', parameters = [] } = signatures[which || 0]
  const activeParameter = param || 0

  const baseOpts = { ...cursorPos(), totalSignatures: signatures.length }

  if (activeParameter < parameters.length) {
    const { label: currentParam = '', documentation: paramDoc } = parameters[activeParameter]
    cache.totalParams = parameters.length

    const [ parsedParamDoc, parsedDocumentation ] = await Promise.all([
      parseDocs(paramDoc),
      parseDocs(documentation),
    ])

    ui.show({
      ...baseOpts,
      label,
      currentParam,
      paramDoc: parsedParamDoc,
      documentation: parsedDocumentation,
      selectedSignature: (which || 0) + 1,
    })
  }

  else {
    const nextSignatureIndex = signatures
      .slice()
      .filter(s => s.parameters && s.parameters.length)
      .sort((a, b) => a.parameters!.length - b.parameters!.length)
      .findIndex(s => s.parameters!.length > activeParameter)

    if (!~nextSignatureIndex) return ui.hide()

    const { label = '', documentation = '', parameters = [] } = signatures[nextSignatureIndex]
    const { label: currentParam = '' } = parameters[activeParameter]
    merge(cache, { selectedSignature: nextSignatureIndex, totalParams: parameters.length })

    ui.show({
      ...baseOpts,
      label,
      currentParam,
      documentation: await parseDocs(documentation),
      selectedSignature: nextSignatureIndex + 1,
    })
  }
}

const getSignatureHint = async (lineContent: string) => {
  const triggerChars = getTriggerChars.signatureHint(nvim.state.cwd, nvim.state.filetype)
  const leftChar = lineContent[Math.max(nvim.state.column - 1, 0)]

  // TODO: should probably also hide if we jumped to another line
  // how do we determine the difference between multiline signatures and exit signature?
  // would need to check if cursor is outside of func brackets doShit(    )   | <- cursor
  const closeSignatureHint = shouldCloseSignatureHint(cache.totalParams, cache.currentParam, triggerChars, leftChar)
  if (closeSignatureHint) return ui.hide()

  if (!triggerChars.has(leftChar)) return
  if (!supports.signatureHint(nvim.state.cwd, nvim.state.filetype)) return

  const hint = await signatureHelp(nvim.state)
  if (!hint) return

  const { activeParameter, activeSignature, signatures = [] } = hint
  if (!signatures.length) return

  merge(cache, { signatures, currentParam: activeParameter, selectedSignature: 0 })
  showSignature(signatures, activeSignature, activeParameter)
}

nvim.on.cursorMove(ui.hide)
nvim.on.insertEnter(ui.hide)
nvim.on.insertLeave(ui.hide)

nvim.onAction('signature-help-next', () => {
  const next = cache.selectedSignature + 1
  cache.selectedSignature = next >= cache.signatures.length ? 0 : next
  cache.currentParam = 0

  showSignature(cache.signatures, cache.selectedSignature)
})

nvim.onAction('signature-help-prev', () => {
  const next = cache.selectedSignature - 1
  cache.selectedSignature = next < 0 ? cache.signatures.length - 1 : next
  cache.currentParam = 0

  showSignature(cache.signatures, cache.selectedSignature)
})

export { getSignatureHint }
