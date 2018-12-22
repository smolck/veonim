import { Symbol, Reference } from '../langserv/adapter'
import { CompletionOption } from '../ai/completions'
import { ColorData } from '../services/colorizer'

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

export interface HoverShow {
  data: ColorData[][]
  doc?: string
}

export enum SymbolMode {
  Buffer,
  Workspace,
}

export type ReferenceResult = [string, Reference[]]

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
  references: {
    show(references: ReferenceResult[], keyword: string): void
  }
  hover: {
    show(options: HoverShow): void
    hide(): void
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
  references: {
    onShow(fn: AI['references']['show']): void
  }
  hover: {
    onShow(fn: AI['hover']['show']): void
    onHide(fn: AI['hover']['hide']): void
  }
}
