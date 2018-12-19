import { Problem, setProblems } from '../ai/diagnostics'
import HttpServer from '../support/http-server'
import nvim from '../neovim/api'

HttpServer(42325).then(({ port, onJsonRequest }) => {
  process.env.VEONIM_REMOTE_PROBLEMS_PORT = port + ''
  nvim.cmd(`let $VEONIM_REMOTE_PROBLEMS_PORT='${port}'`)
  onJsonRequest<Problem[]>((data, reply) => (setProblems(data), reply(201)))
})
