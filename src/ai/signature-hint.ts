import { SignatureInformation, MarkdownString } from 'vscode'
import { SignatureHelpTriggerKind } from '../vscode/types'
import { merge, PromiseBoss } from '../support/utils'
import { markdownToHTML } from '../support/markdown'
import { vscode } from '../core/extensions-api'
import nvim from '../neovim/api'
import { ui } from '../core/ai'

const boss = PromiseBoss()

const cache = {
  signatures: [] as SignatureInformation[],
  selectedSignature: 0,
  totalParams: 0,
  currentParam: 0,
}

const shouldCloseSignatureHint = (
  totalParams: number,
  currentParam: number,
  triggers: Set<string>,
  leftChar: string
): boolean => {
  if (currentParam < totalParams - 1) return false

  const matching = triggers.has('(') || triggers.has('{') || triggers.has('[')
  if (!matching) return true

  return (
    (leftChar === ')' && triggers.has('(')) ||
    (leftChar === '}' && triggers.has('{')) ||
    (leftChar === ']' && triggers.has('['))
  )
}

const parseDocs = async (
  docs?: string | MarkdownString
): Promise<string | undefined> => {
  if (!docs) return
  return typeof docs === 'string' ? docs : markdownToHTML(docs.value)
}

const showSignature = async (
  signatures: SignatureInformation[],
  which?: number | null,
  param?: number | null
) => {
  const { label = '', documentation = '', parameters = [] } = signatures[
    which || 0
  ]
  const activeParameter = param || 0

  const cursorPosition = await nvim.getCursorPosition()
  const baseOpts = { ...cursorPosition, totalSignatures: signatures.length }

  if (activeParameter < parameters.length) {
    cache.totalParams = parameters.length
    const { label: paramLabel, documentation: paramDoc } = parameters[
      activeParameter
    ]
    const currentParam = Array.isArray(paramLabel)
      ? label.slice(paramLabel[0], paramLabel[1])
      : paramLabel || ''

    const [parsedParamDoc, parsedDocumentation] = await Promise.all([
      parseDocs(paramDoc),
      parseDocs(documentation),
    ])

    ui.signatureHint.show({
      ...baseOpts,
      label,
      currentParam,
      paramDoc: parsedParamDoc,
      documentation: parsedDocumentation,
      selectedSignature: (which || 0) + 1,
    })
  } else {
    const nextSignatureIndex = signatures
      .slice()
      .filter((s) => s.parameters && s.parameters.length)
      .sort((a, b) => a.parameters!.length - b.parameters!.length)
      .findIndex((s) => s.parameters!.length > activeParameter)

    if (!~nextSignatureIndex) return ui.signatureHint.hide()

    const { label = '', documentation = '', parameters = [] } = signatures[
      nextSignatureIndex
    ]
    const { label: currentParam = '' } = parameters[activeParameter]
    merge(cache, {
      selectedSignature: nextSignatureIndex,
      totalParams: parameters.length,
    })

    ui.signatureHint.show({
      ...baseOpts,
      label,
      currentParam,
      documentation: await parseDocs(documentation),
      selectedSignature: nextSignatureIndex + 1,
    })
  }
}

const getSignatureHint = async (lineContent: string) => {
  const signatureHintTriggerCharacters = await vscode.language.getSignatureHelpTriggerCharacters()
    .promise
  const triggerChars = new Set(signatureHintTriggerCharacters)
  const leftChar = lineContent[Math.max(nvim.state.column - 1, 0)]

  // TODO: should probably also hide if we jumped to another line
  // how do we determine the difference between multiline signatures and exit signature?
  // would need to check if cursor is outside of func brackets doStuff(    )   | <- cursor
  const closeSignatureHint = shouldCloseSignatureHint(
    cache.totalParams,
    cache.currentParam,
    triggerChars,
    leftChar
  )
  if (closeSignatureHint) return ui.signatureHint.hide()

  if (!triggerChars.has(leftChar)) return
  const hint = await boss.schedule(
    vscode.language.provideSignatureHelp({
      triggerKind: SignatureHelpTriggerKind.TriggerCharacter,
      triggerCharacter: leftChar,
      // TODO: let the provider know if the signature hint is currently visible or not
      isRetrigger: false,
    }),
    { timeout: 2e3 }
  )
  if (!hint) return

  const { activeParameter, activeSignature, signatures = [] } = hint
  if (!signatures.length) return

  merge(cache, {
    signatures,
    currentParam: activeParameter,
    selectedSignature: 0,
  })
  showSignature(signatures, activeSignature, activeParameter)
}

nvim.on.cursorMove(() => ui.signatureHint.hide())
nvim.on.insertEnter(() => ui.signatureHint.hide())
nvim.on.insertLeave(() => ui.signatureHint.hide())

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
