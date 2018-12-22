import { CompletionOption } from '../ai/completions'

export interface CompletionShow {
  row: number
  col: number
  options: CompletionOption[]
}

export interface AI {
  completions: {
    show(options: CompletionShow): void
    hide(): void
  }
}

export interface AIClient {
  completions: {
    onShow(fn: AI['completions']['show']): void
    onHide(fn: AI['completions']['hide']): void
  }
}
