// https://github.com/Microsoft/vscode/blob/master/src/vs/workbench/api/node/extHostTypeConverters.ts

import * as vscode from 'vscode'
import * as types from '../vscode/types'
import { LanguageSelector, LanguageFilter } from '../vscode/language-selector'

export function globPatternFrom(
  pattern: vscode.GlobPattern
): string | types.RelativePattern {
  if (pattern instanceof types.RelativePattern) {
    return pattern
  }

  if (typeof pattern === 'string') {
    return pattern
  }

  if (isRelativePattern(pattern)) {
    return new types.RelativePattern(pattern.base, pattern.pattern)
  }

  return pattern // preserve `undefined` and `null`
}

function isRelativePattern(obj: any): obj is vscode.RelativePattern {
  const rp = obj as vscode.RelativePattern
  return rp && typeof rp.base === 'string' && typeof rp.pattern === 'string'
}

export function languageSelectorFrom(
  selector: vscode.DocumentSelector
): LanguageSelector | undefined {
  if (!selector) {
    return undefined
  } else if (Array.isArray(selector)) {
    return <LanguageSelector>selector.map(languageSelectorFrom)
  } else if (typeof selector === 'string') {
    return selector
  } else {
    return <LanguageFilter>{
      language: selector.language,
      scheme: selector.scheme,
      // @ts-ignore - typescript is dummmmmmmbbb
      pattern: globPatternFrom(selector.pattern),
      // @ts-ignore - typescript is dummmmmmmbbb
      exclusive: selector.exclusive,
    }
  }
}
