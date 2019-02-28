import { ensureDir, remove, getDirs, rename } from '../support/utils'
import { on } from '../messaging/worker-client'
import { Archiver } from '../support/binaries'
import { fetchStream } from '../support/fetch'
import { createWriteStream } from 'fs'

const downloadZip = (url: string, path: string) => new Promise(async done => {
  const downloadStream = await fetchStream(url)
  const fileStream = createWriteStream(`${path}.zip`)

  downloadStream
    .pipe(fileStream)
    .on('close', done)
    .on('error', done)
})

const unzip = (path: string) => new Promise(done => Archiver(['open', `${path}.zip`, path])
  .on('close', done)
  .on('error', done))

on.download(async (url: string, path: string) => {
  const tempPath = `${path}_temp`
  await ensureDir(tempPath)

  const downloadErr = await downloadZip(url, tempPath)
  if (downloadErr) {
    console.error('download fail:', url, tempPath, downloadErr)
    return false
  }

  const unzipErr = await unzip(tempPath)
  if (unzipErr) console.error('unzip fail:', url, tempPath, unzipErr)

  const dirs = await getDirs(tempPath)

  if (dirs.length === 1) {
    await rename(dirs[0].path, path)
    await remove(tempPath)
  }

  await remove(`${tempPath}.zip`).catch(console.error)
  return !unzipErr
})
