import SessionTransport from '../messaging/session-transport'

// @ts-ignore - typescript is confused about web workers
const { send, connectTo, switchTo } = SessionTransport(m => postMessage(m))

onmessage = ({ data }: MessageEvent) => {
  if (Array.isArray(data) && data[0] === 65) return connectTo(data[1])
  if (Array.isArray(data) && data[0] === 66) return switchTo(data[1])
  send(data)
}
