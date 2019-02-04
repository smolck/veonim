const { src, same } = require('../util')
const m = src('support/utils')

const nix = process.platform === 'linux' || process.platform === 'darwin'

if (nix) {

describe('path parts', () => {
  it('root path', () => {
    const testpath = '/Users/a/veonim'
    const res = m.pathParts(testpath)
    same(res, ['/', 'Users', 'a', 'veonim'])
  })

  it('relative dot path', () => {
    const testpath = './Users/a/veonim/'
    const res = m.pathParts(testpath)
    same(res, ['Users', 'a', 'veonim'])
  })

  it('relative path', () => {
    const testpath = 'a/veonim/'
    const res = m.pathParts(testpath)
    same(res, ['a', 'veonim'])
  })

  it('path segments', () => {
    const testpath = '/Users/a/../'
    const res = m.pathParts(testpath)
    same(res, ['/', 'Users'])
  })
})

}

describe('thread safe object', () => {
  it('convert getters to plain values', () => {
    class Position {
      constructor(line, column) {
        this._line = line
        this._column = column
      }

      get line() { return this._line }
      get column() { return this._column }
    }

    class Range {
      constructor(sline, scol, eline, ecol) {
        this._start = new Position(sline, scol)
        this._end = new Position(eline, ecol)
      }

      get start() { return this._start }
      get end() { return this._end }
    }

    const input = new Range(1, 2, 3, 4)
    const output = m.threadSafeObject(input)

    const start = {
      line: 1,
      _line: 1,
      column: 2,
      _column: 2,
    }

    const end = {
      line: 3,
      _line: 3,
      column: 4,
      _column: 4,
    }

    same(output, {
      start,
      end,
      _start: start,
      _end: end,
    })
  })

  it('convert getters inside arrays', () => {
    class Galaxy {
      constructor() { this._distance = 'far-far-away' }
      get distance() { return this._distance }
    }

    const input = {
      empire: 'strikes-back',
      galaxies: [ 'return-of-the-jedi', new Galaxy() ]
    }

    const output = m.threadSafeObject(input)

    same(output, {
      empire: 'strikes-back',
      galaxies: [
        'return-of-the-jedi',
        { distance: 'far-far-away', _distance: 'far-far-away' },
      ]
    })
  })

  it('convert an array that contains getter objects', () => {
    class Galaxy {
      constructor() { this._distance = 'far-far-away' }
      get distance() { return this._distance }
    }

    const input = [ new Galaxy(), new Galaxy() ]
    const output = m.threadSafeObject(input)

    same(output, [
      { _distance: 'far-far-away', distance: 'far-far-away' },
      { _distance: 'far-far-away', distance: 'far-far-away' },
    ])
  })
})
