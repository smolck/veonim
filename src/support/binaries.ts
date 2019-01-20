import { SpawnOptions, ChildProcess, spawn } from 'child_process'
import { dirname, join } from 'path'

const platforms = new Map([
  ['darwin', 'mac'],
  ['win32', 'win'],
  ['linux', 'linux'],
])

const os = platforms.get(process.platform)
if (!os) throw new Error(`Unsupported platform ${process.platform}`)

type Binary = (args?: string[], options?: SpawnOptions) => ChildProcess

interface INeovim {
  run: Binary,
  runtime: string,
  path: string,
}

const NVIM_PATH = process.env.VEONIM_NVIM_PATH || dirname(require.resolve(`@veonim/neovim-${os}`))

const binary = os === 'win' ? 'nvim.exe' : 'nvim'
const binPath = join(NVIM_PATH, 'bin', binary)

export const Neovim: INeovim = {
  run: (args, opts) => spawn(binPath, args, opts),
  runtime: join(NVIM_PATH, 'share', 'runtime'),
  path: join(NVIM_PATH, 'share'),
}

export const Ripgrep: Binary = require(`@veonim/ripgrep-${os}`).default
export const Archiver: Binary = require(`all-other-unzip-libs-suck-${os}`).default
