import { ensureDir, remove, getDirs, rename } from '../support/utils'
import { Archiver } from '../support/binaries'
import { fetchStream } from '../support/fetch'
import { createWriteStream } from 'fs'

export const url = {
  github: (org: string, repo: string) => `https://github.com/${org}/${repo}/archive/master.zip`,
  veonim: (repo: string) => `https://github.com/veonim/${repo}/archive/master.zip`,
  vscode: (publisher: string, name: string, version = 'latest') => `https://${publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${name}/${version}/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`,
}

const downloadZip = (url: string, path: string) => new Promise(async done => {
  const downloadStream = await fetchStream(url)
  const fileStream = createWriteStream(`${path}.zip`)

  downloadStream
    .pipe(fileStream)
    .on('close', done)
    .on('error', done)
})

const unzip = (path: string) => new Promise(done => Archiver(['unarchive', `${path}.zip`, path])
  .on('close', done)
  .on('error', done))

export const download = async (url: string, path: string, name?: string, progress?: (msg: string) => void): Promise<boolean> => {
  const tempPath = `${path}_temp`
  await ensureDir(tempPath)

  progress && progress(`Downloading ${name}`)
  const downloadErr = await downloadZip(url, tempPath)
  if (downloadErr) {
    console.error('download fail:', url, tempPath, downloadErr)
    return false
  }

  progress && progress(`Extracting ${name} from archive`)
  const unzipErr = await unzip(tempPath)
  if (unzipErr) console.error('unzip fail:', url, tempPath, unzipErr)

  const dirs = await getDirs(tempPath)

  if (dirs.length === 1) {
    await rename(dirs[0].path, path)
    await remove(tempPath)
  }

  await remove(`${tempPath}.zip`).catch(console.error)
  return !unzipErr
}
