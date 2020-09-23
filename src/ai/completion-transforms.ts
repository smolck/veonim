import { CompletionOption, CompletionKind } from '../ai/completions'
import { is } from '../support/utils'
import { parse } from 'path'

interface CompletionTransformRequest {
  completionKind: CompletionKind
  lineContent: string
  column: number
  completionOptions: CompletionOption[]
}

type Transformer = (request: CompletionTransformRequest) => CompletionOption[]
const transforms = new Map<string, Transformer>()

export default (filetype: string, request: CompletionTransformRequest) => {
  const transformer = transforms.get(filetype)
  const callable = is.function(transformer) || is.asyncfunction(transformer)
  if (transformer && callable) return transformer(request)
  return request.completionOptions
}

const isModuleImport = (lineContent: string, column: number) => {
  const fragment = lineContent.slice(0, column - 1)
  return (
    /\b(from|import)\s*["'][^'"]*$/.test(fragment) ||
    /\b(import|require)\(['"][^'"]*$/.test(fragment)
  )
}

const removeFileExtensionsInImportPaths = ({
  completionKind,
  completionOptions,
  lineContent,
  column,
}: CompletionTransformRequest) => {
  // in the future these can be separated into different modules and organized
  // better. for MVP this will be good enough
  if (completionKind !== CompletionKind.Path) return completionOptions

  const tryingToCompleteInsideImportPath = isModuleImport(lineContent, column)
  if (!tryingToCompleteInsideImportPath) return completionOptions

  return completionOptions.map((o) => ({
    ...o,
    insertText: parse(o.text).name,
  }))
}

transforms.set('typescript', removeFileExtensionsInImportPaths)
transforms.set('javascript', removeFileExtensionsInImportPaths)
