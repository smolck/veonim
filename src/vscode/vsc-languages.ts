// this module exists because we can't always map 1:1 between vim
// filetypes and vscode language ids. for example in vim we might
// have javascript.jsx which the equivalent in vscode would be
// javascriptreact

// valid vscode identifiers
// https://code.visualstudio.com/docs/languages/identifiers

const filetypes = new Map<string, string>([
  ['javascript.jsx', 'javascript'],
  ['typescript.tsx', 'typescript'],
])

export default (filetype: string) => filetypes.get(filetype) || filetype
export const vscLanguageToFiletypes = (languageId: string): string[] => [...filetypes]
  .reduce((res, [ ft, id ]) => {
    if (id === languageId) res.push(ft)
    return res
  }, [ languageId ])
