// import { onCreateVim, onSwitchVim } from '../core/instance-manager'
import setupRPC from '../messaging/rpc'
import Neovim from '../neovim/api'

export { NeovimState } from '../neovim/state'

const io = new Worker(`${__dirname}/../workers/neovim-client.js`)
const { onData, ...rpcAPI } = setupRPC(m => io.postMessage(m))
io.onmessage = ({ data: [kind, data] }: MessageEvent) => onData(kind, data)

const onCreateVim = () => {}
const onSwitchVim = () => {}

onCreateVim(info => io.postMessage([65, info]))
onSwitchVim(id => io.postMessage([66, id]))

export default Neovim({ ...rpcAPI, onCreateVim, onSwitchVim })
