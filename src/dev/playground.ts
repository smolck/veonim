const vscode = require('vscode')

const playProgressMessage = () => {
  const m1 = vscode.window.showWarningMessage('u gonna receiv a paddlin fo dat son!', 'Oh no')
  // @ts-ignore
  m1.then(m => console.log('warn res:', m))

  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Downloading and installing VSCode extensions',
    // cancellable: true,
    // @ts-ignore
  }, (progress, token) => {
    token.onCancellationRequested(() => {
      console.log('STOP! hammer time!')
    })

    setTimeout(() => {
      progress.report({ increment: 10, message: 'downloading extensions'})
    }, 1000)

    setTimeout(() => {
      progress.report({ increment: 50, message: 'unzip extensions'})
    }, 2000)

    setTimeout(() => {
      progress.report({ increment: 90, message: 'install extensions'})
    }, 3000)

    return new Promise(done => setTimeout(done, 5e3))
  })
}

export default () => {
  playProgressMessage()
}
