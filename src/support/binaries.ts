import { SpawnOptions, ChildProcess, spawn } from 'child_process'
import { join } from 'path'

type Binary = (args?: string[], options?: SpawnOptions) => ChildProcess

const binpath = join(__dirname, '..', 'binaries')
const spawnBinary = (
  command: string,
  args?: readonly string[],
  options?: SpawnOptions
) => {
  const name = process.platform === 'win32' ? `${command}.exe` : command
  return spawn(name, args ?? [], options ?? {})
}

export const Ripgrep: Binary = (args, opts) =>
  spawnBinary(join(binpath, 'ripgrep', 'rg'), args, opts)
export const Archiver: Binary = (args, opts) =>
  spawnBinary(join(binpath, 'archiver'), args, opts)
