import Worker from '../messaging/worker'

const state = { worker: Worker('download') }

export const url = {
  veonim: (repo: string) => `https://github.com/veonim/${repo}/archive/master.zip`,
  vscode: (publisher: string, name: string, version = 'latest') => `https://${publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${name}/${version}/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`,
}

export const download = (url: string, path: string): Promise<boolean> => {
  if (!state.worker) state.worker = Worker('download')
  return state.worker.request.download(url, path)
}

export const dispose = () => {
  if (!state.worker) return
  state.worker.terminate()
}
