import { CompletionOption } from '../ai/completions'

interface CompletionShow {
  row: number
  col: number
  options: CompletionOption[]
}

export interface AIUI {
  completions: {
    show(options: CompletionShow): void
    hide(): void
  }
}
