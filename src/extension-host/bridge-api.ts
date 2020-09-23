import {
  Message,
  MessageReturn,
  MessageStatusUpdate,
} from '../protocols/veonim'
import { request, call } from '../messaging/worker-client'
import { uuid } from '../support/utils'

export const showMessage = async (message: Message): Promise<MessageReturn> => {
  const id = uuid()
  const promise = request.showVSCodeMessage(id, message)
  const remove = () => {}
  const setProgress = () => {}
  return { promise, remove, setProgress }
}
export const showStatusBarMessage = (message: string) =>
  call.showStatusBarMessage(message)
export const showProgressMessage = async (
  message: Message
): Promise<MessageReturn> => {
  const id = uuid()
  const promise = request.showVSCodeMessage(id, message)
  const remove = () => request.removeVSCodeMessageProgress(id)
  const setProgress = (update: MessageStatusUpdate) =>
    request.updateVSCodeMessageProgress(id, update)
  return { promise, remove, setProgress }
}
