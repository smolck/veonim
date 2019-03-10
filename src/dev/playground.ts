const vscode = require('vscode')

const playProgressMessage = () => {
  vscode.window.showWarningMessage('u gonna receiv a paddlin fo dat son!', 'Oh no')

  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "this is cool",
    cancellable: true,
    // @ts-ignore
  }, (progress, token) => {
    token.onCancellationRequested(() => {
      console.log("CANCELED")
    })

    setTimeout(() => {
      progress.report({ percentage: 10, message: "still going..."})
    }, 1000)

    setTimeout(() => {
      progress.report({ percentage: 50, message: "still going harder..."})
    }, 2000)

    setTimeout(() => {
      progress.report({ percentage: 90, message: "almost there..."})
    }, 3000)

    var p = new Promise(resolve => {
      setTimeout(() => {
        resolve()
      }, 5000)
    })

    return p
  })
}

export default () => {
  playProgressMessage()
}
