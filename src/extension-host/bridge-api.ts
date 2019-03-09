import { request, call } from '../messaging/worker-client'
import { Message } from '../protocols/veonim'

export const showMessage = (message: Message) => request.showVSCodeMessage(message)
export const showStatusBarMessage = (message: string) => call.showStatusBarMessage(message)
