import { CompletionOption } from '../ai/completions'
import { Symbol } from '../langserv/adapter'

export interface CompletionShow {
  row: number
  col: number
  options: CompletionOption[]
}

export interface SignatureHintShow {
  row: number
  col: number
  label: string
  currentParam: string
  paramDoc?: string
  documentation?: string
  selectedSignature: number
  totalSignatures: number
}

export enum SymbolMode {
  Buffer,
  Workspace,
}

export interface AI {
  completions: {
    show(options: CompletionShow): void
    hide(): void
  }
  signatureHint: {
    show(options: SignatureHintShow): void
    hide(): void
  }
  symbols: {
    show(symbols: Symbol[], mode: SymbolMode): void
  }
}

export interface AIClient {
  completions: {
    onShow(fn: AI['completions']['show']): void
    onHide(fn: AI['completions']['hide']): void
  }
  signatureHint: {
    onShow(fn: AI['signatureHint']['show']): void
    onHide(fn: AI['signatureHint']['hide']): void
  }
  symbols: {
    onShow(fn: AI['symbols']['show']): void
  }
}
