import getLineContents, { LocationResult } from '../neovim/get-line-contents'
import { findNext, findPrevious } from '../support/relative-finder'
import { references as getReferences } from '../langserv/adapter'
import { Reference, ReferenceResult } from '../ai/protocol'
import { supports } from '../langserv/server-features'
import { vscode } from '../core/extensions-api'
import { PromiseBoss } from '../support/utils'
import nvim from '../neovim/api'
import { ui } from '../core/ai'

const groupResults = (m: LocationResult[]): ReferenceResult[] => [...m.reduce((map, ref: LocationResult) => {
  map.has(ref.path)
    ? map.get(ref.path)!.push(ref)
    : map.set(ref.path, [ ref ])

  return map
}, new Map<string, LocationResult[]>())]

const boss = PromiseBoss()

nvim.onAction('references', async () => {
  const results = await boss.schedule(vscode.language.provideReferences(), { timeout: 3e3 })
  console.log('results', results)
  if (!results) return

  const references = await getLineContents(results)
  const [ ref1 ] = references
  const keyword = ref1.lineContents.slice(ref1.range.start.character, ref1.range.end.character)

  const referencesForUI = groupResults(references)
  ui.references.show(referencesForUI, keyword)
})

nvim.onAction('next-usage', async () => {
  if (!supports.references(nvim.state.cwd, nvim.state.filetype)) return

  const { references } = await getReferences(nvim.state)
  if (!references.length) return

  const { line, column, absoluteFilepath } = nvim.state
  const reference = findNext<Reference>(references, absoluteFilepath, line, column)
  if (reference) nvim.jumpTo(reference)
})

nvim.onAction('prev-usage', async () => {
  if (!supports.references(nvim.state.cwd, nvim.state.filetype)) return

  const { references } = await getReferences(nvim.state)
  if (!references.length) return

  const { line, column, absoluteFilepath } = nvim.state
  const reference = findPrevious<Reference>(references, absoluteFilepath, line, column)
  if (reference) nvim.jumpTo(reference)
})
