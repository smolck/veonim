const { src, same } = require('../util')
const { append, replace, remove } = src('neovim/text-edit-patch')

describe('text edit patch', () => {
  it('append', () => {
    const req = {
      lines: [
        'you were the chosen one',
        'you were supposed to destroy the sith',
        'not join them',
      ],
      column: 12,
      text: 'JEDI ',
    }

    const patch = append(req)
    same(patch, [
      'you were the JEDI chosen one',
      'you were supposed to destroy the sith',
      'not join them',
    ])
  })

  it('append with newlines', () => {
    const req = {
      lines: [
        'you were the chosen one',
        'you were supposed to destroy the sith',
        'not join them',
      ],
      column: 12,
      text: 'JEDI\nonly a sith\ndeals in absolutes\n',
    }

    const patch = append(req)
    same(patch, [
      'you were the JEDI',
      'only a sith',
      'deals in absolutes',
      'chosen one',
      'you were supposed to destroy the sith',
      'not join them',
    ])
  })

  it('replace', () => {
    const req = {
      lines: [
        'you were the chosen one',
        'you were supposed to destroy the sith',
        'not join them',
      ],
      start: { line: 1, column: 4 },
      end: { line: 1, column: 20 },
      text: 'hello there',
    }

    const patch = append(req)
    same(patch, [
      'you were the chosen one',
      'you hello there destroy the sith',
      'not join them',
    ])
  })

  it('replace across multiple lines', () => {
    const req = {
      lines: [
        'you were the chosen one',
        'you were supposed to destroy the sith',
        'not join them',
      ],
      start: { line: 1, column: 4 },
      end: { line: 2, column: 3 },
      text: 'general kenobi',
    }

    const patch = append(req)
    same(patch, [
      'you were the chosen one',
      'you general kenobi join them',
    ])
  })

  it('replace with newlines', () => {
    const req = {
      lines: [
        'you were the chosen one',
        'you were supposed to destroy the sith',
        'not join them',
      ],
      start: { line: 1, column: 4 },
      end: { line: 2, column: 3 },
      text: `did you ever hear\nthe tragedy of darth plagueis the wise\nit's not a story\nthe jedi would tell you\n`,
    }

    const patch = append(req)
    same(patch, [
      'you were the chosen one',
      'you did you ever hear',
      'the tragedy of darth plagueis the wise',
      `it's not a story`,
      'the jedi would tell you',
      'join them',
    ])
  })

  it('remove', () => {
    const req = {
      lines: [
        'you were the chosen one',
        'you were supposed to destroy the sith',
        'not join them',
      ],
      start: { line: 1, column: 2 },
      end: { line: 2, column: 2 },
    }

    const patch = append(req)
    same(patch, [
      'you were the chosen one',
      'yo join them',
    ])
  })
})
