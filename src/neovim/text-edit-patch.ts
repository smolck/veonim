interface AppendPatch {
  lines: string[]
  column: number
  text: string
}

interface Range {
  line: number
  column: number
}

interface ReplacePatch {
  lines: string[]
  start: Range
  end: Range
  text: string
}

interface DeletePatch {
  lines: string[]
  start: Range
  end: Range
}

export const append = ({ lines, column, text }: AppendPatch): string[] => {

}

export const replace = ({ lines, start, end, text }: ReplacePatch): string[] => {

}

export const remove = ({ lines, start, end }: DeletePatch): string[] => {

}
