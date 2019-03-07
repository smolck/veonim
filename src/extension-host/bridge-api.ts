import { request } from '../messaging/worker-client'
import { Message } from '../protocols/veonim'

export const showMessage = (message: Message) => request.showVSCodeMessage(message)
