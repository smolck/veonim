import { Diagnostic, Command } from 'vscode-languageserver-protocol'
import { LocationResult } from '../neovim/get-line-contents'
import { Providers } from '../extension-host/providers'
import { CompletionOption } from '../ai/completions'
import { ColorData } from '../services/colorizer'
import { UnPromisify } from '../support/types'

export type Symbol = NonNullable<UnPromisify<ReturnType<Providers['provideDocumentSymbols']>['promise']>>[0]
export type WorkspaceSymbol = NonNullable<UnPromisify<ReturnType<Providers['provideWorkspaceSymbols']>['promise']>>[0]
export type Reference = NonNullable<UnPromisify<ReturnType<Providers['provideReferences']>['promise']>>[0]
export type ReferenceResult = [string, LocationResult[]]

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

export interface ProblemCount {
  errors: number
  warnings: number
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
    show(symbols: Symbol[]): void
  }
  workspaceSymbols: {
    show(symbols: WorkspaceSymbol[]): void
  }
  references: {
    show(references: ReferenceResult[], keyword: string): void
  }
  hover: {
    show(options: HoverShow): void
    hide(): void
  }
  problemInfo: {
    show(message: string): void
    hide(): void
  }
  codeAction: {
    show(row: number, col: number, actions: Command[]): void
  }
  problems: {
    update(problems: Diagnostic[]): void
    toggle(): void
    focus(): void
  }
  problemCount: {
    update(count: ProblemCount): void
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
  workspaceSymbols: {
    onShow(fn: AI['workspaceSymbols']['show']): void
  }
  references: {
    onShow(fn: AI['references']['show']): void
  }
  hover: {
    onShow(fn: AI['hover']['show']): void
    onHide(fn: AI['hover']['hide']): void
  }
  problemInfo: {
    onShow(fn: AI['problemInfo']['show']): void
    onHide(fn: AI['problemInfo']['hide']): void
  }
  codeAction: {
    onShow(fn: AI['codeAction']['show']): void
  }
  problems: {
    onUpdate(fn: AI['problems']['update']): void
    onToggle(fn: AI['problems']['toggle']): void
    onFocus(fn: AI['problems']['focus']): void
  }
  problemCount: {
    onUpdate(fn: AI['problemCount']['update']): void
  }
}
