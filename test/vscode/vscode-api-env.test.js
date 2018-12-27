const { src, same } = require('../util')
const launch = require('./launcher')

describe('vscode api - env', () => {
  let env
  let m

  beforeEach(async () => {
    m = await launch()
    env = src('vscode/env').default
  })

  after(() => m.stop())

  describe('var', () => {
    it('appName', () => {
      same(env.appName, 'Veonim')
    })

    it('appRoot', () => {
      same(env.appRoot, process.cwd())
    })

    it('language', () => {
      same(env.language, 'en-US')
    })

    it('machineId', () => {
      same(env.machineId, require('os').hostname())
    })

    it('sessionId', () => {
      const includesName = env.sessionId.includes('Veonim-')
      same(includesName, true, 'sessionId starts with Veonim-')
    })
  })
})
