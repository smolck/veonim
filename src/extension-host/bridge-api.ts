import { request, call } from '../messaging/worker-client'
import { Message, MessageReturn } from '../protocols/veonim'

export const showMessage = (message: Message): Promise<MessageReturn> => request.showVSCodeMessage(message)
export const showStatusBarMessage = (message: string) => call.showStatusBarMessage(message)
