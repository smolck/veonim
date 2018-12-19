import { references as getReferences, Reference } from '../langserv/adapter'
import { findNext, findPrevious } from '../support/relative-finder'
import { supports } from '../langserv/server-features'
import { show } from '../components/references'
import nvim from '../neovim/api'

const groupResults = (m: Reference[]) => [...m.reduce((map, ref: Reference) => {
  map.has(ref.path)
    ? map.get(ref.path)!.push(ref)
    : map.set(ref.path, [ ref ])

  return map
}, new Map<string, Reference[]>())]

nvim.onAction('references', async () => {
  if (!supports.references(nvim.state.cwd, nvim.state.filetype)) return

  const { keyword, references } = await getReferences(nvim.state)
  if (!references.length) return

  const referencesForUI = groupResults(references)
  show(referencesForUI, keyword)
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
