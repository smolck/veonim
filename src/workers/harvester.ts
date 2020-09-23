import TextDocumentManager from '../neovim/text-document-manager'
import { filter as fuzzy } from 'fuzzaldrin-plus'
import { on } from '../messaging/worker-client'
import { patchAllTexts } from '../support/diff'
import nvim from '../neovim/api'

const tdm = TextDocumentManager(nvim)
const keywords = new Map<string, string[]>()
const insertChanges = {
  file: '',
  changes: [] as string[],
}
let isInsertMode = false

const addKeywords = (file: string, words: string[]) => {
  const e = keywords.get(file) || []
  words.forEach((word) => {
    if (e.includes(word)) return
    keywords.set(file, (e.push(word), e))
  })
}

const harvestInsertMode = (file: string, textLines: string[]) => {
  const changedText = textLines.join('\n')
  insertChanges.file = file
  insertChanges.changes.push(changedText)
}

const harvest = (file: string, textLines: string[]) => {
  if (isInsertMode) return harvestInsertMode(file, textLines)

  const harvested = new Set<string>()
  const totalol = textLines.length

  for (let ix = 0; ix < totalol; ix++) {
    const words = textLines[ix].match(/\w+/g) || []
    const wordsTotal = words.length

    for (let wix = 0; wix < wordsTotal; wix++) {
      const word = words[wix]
      if (word.length > 2) harvested.add(word)
    }
  }

  const nextKeywords = new Set([...(keywords.get(file) || []), ...harvested])
  keywords.set(file, [...nextKeywords])
}

nvim.on.insertEnter(() => (isInsertMode = true))
nvim.on.insertLeave(async () => {
  isInsertMode = false
  const changedText = patchAllTexts(insertChanges.changes)
  const words = changedText.match(/\w+/g) || []
  addKeywords(insertChanges.file, words)
  insertChanges.changes = []
})

tdm.on.didOpen(({ name, textLines }) => harvest(name, textLines))
tdm.on.didChange(({ name, textLines }) => harvest(name, textLines))
tdm.on.didClose(({ name }) => keywords.delete(name))

on.query(async (file: string, query: string, maxResults: number = 25) => {
  return fuzzy(keywords.get(file) || [], query, { maxResults })
})
