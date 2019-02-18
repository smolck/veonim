import { NewlineSplitter, ensureDir, remove } from '../support/utils'
import { Ripgrep } from '../support/binaries'
import { promisify as P } from 'util'
import { dirname, join } from 'path'
import * as fs from 'fs'

interface CopyOptions {
  overwrite?: boolean
}

const listFiles = (path: string): Promise<string[]> => new Promise((done, fail) => {
  const results = [] as string[]
  const rg = Ripgrep(['--files'], { cwd: path })
  rg.stderr.pipe(new NewlineSplitter()).on('data', fail)
  rg.stdout.pipe(new NewlineSplitter()).on('data', (file: string) => results.push(file))
  rg.on('close', () => done(results))
})

const isFile = async (path: string) => (await P(fs.stat)(path)).isFile()
const copyFile = (src: string, dest: string) => P(fs.copyFile)(src, dest)

/** Copy file or dir from source to destination path. Destination path should be the final path. */
export default async (srcPath: string, destPath: string, options = {} as CopyOptions) => {
  if (await isFile(srcPath)) {
    await ensureDir(destPath)
    return copyFile(srcPath, destPath)
  }

  if (options.overwrite) await remove(destPath)

  const allFiles = await listFiles(srcPath)
  return Promise.all(allFiles.map(async file => {
    const destdir = join(destPath, dirname(file))
    await ensureDir(destdir)
    const srcfile = join(srcPath, file)
    const dstfile = join(destPath, file)
    return copyFile(srcfile, dstfile)
  }))
}
