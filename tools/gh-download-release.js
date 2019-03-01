'use strict'
const { fetchStream, fromJSON, fromRoot, getDirFiles } = require('./runner')
const Archiver = require('all-other-unzip-libs-suck').default
const { extname } = require('path')
const fs = require('fs-extra')

const getDirs = path => getDirFiles(path).then(m => m.filter(f => f.dir))
const unzip = (src, dest) => new Promise(done => Archiver(['open', src, dest])
  .on('exit', done)
  .on('error', done))

module.exports = ({ org, repo, tag, mac, win, linux }, dlpath) => new Promise(async (done, fail) => {
  await fs.ensureDir(fromRoot(dlpath))
  const file = ({ 'darwin': mac, 'win32': win, 'linux': linux })[process.platform]
  const dlfile = file.replace('${tag}', tag)
  const url = `https://github.com/${org}/${repo}/releases/download/${tag}/${dlfile}`
  const extension = extname(dlfile)
  const unpack = ['.gz', '.zip'].includes(extension)

  const realPath = fromRoot(dlpath, repo + extension)
  const tempPath = fromRoot(dlpath, `${repo}_temp`)
  const unpackPath = fromRoot(dlpath, repo)
  const downloadPath = fromRoot(dlpath, dlfile)
  const filename = unpack ? downloadPath : realPath

  const testExistPath = unpack ? unpackPath : realPath
  const alreadyExists = await fs.pathExists(testExistPath)
  if (alreadyExists) return console.log(`binary "${repo}" already exists in "${dlpath}" skipping download`)

  console.log('downloading:', url)
  const dest = fs.createWriteStream(filename)
  const stream = await fetchStream(url).catch(fail)

  stream.pipe(dest).on('error', fail).on('close', async () => {
    console.log('downloaded binary:', filename)
    if (!unpack) return done({ org, repo, tag, url, filename })
    const unzipErr = await unzip(filename, tempPath).catch(e => console.error('unzip err:', e))
    if (unzipErr) console.error('unzip fail:', unzipErr)
    const dirs = await getDirs(tempPath)

    if (dirs.length === 1) await fs.move(dirs[0].path, unpackPath)
    await fs.remove(tempPath).catch(console.error)
    await fs.remove(filename).catch(console.error)
    console.log(`unpacked binary: ${filename} -> ${unpackPath}`)
    done({ org, repo, tag, url, filename: unpackPath })
  })
})
