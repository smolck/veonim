import { VimOption, BufferEvent, HyperspaceCoordinates, BufferType, BufferHide, BufferOption, Buffer, Window, Tabpage, GenericCallback, BufferInfo } from '../neovim/types'
import { Api, ExtContainer, Prefixes, Buffer as IBuffer, Window as IWindow, Tabpage as ITabpage } from '../neovim/protocol'
import { is, onFnCall, onProp, prefixWith, uuid, simplifyPath } from '../support/utils'
import ConnectMsgpackRPC from '../messaging/msgpack-transport'
import { workerData } from '../messaging/worker-client'
import { Functions } from '../neovim/function-types'
import { Autocmds } from '../neovim/startup'
import CreateVimState from '../neovim/state'
import { Patch } from '../langserv/patch'
import { basename, dirname } from 'path'
import { EventEmitter } from 'events'

const prefix = {
  core: prefixWith(Prefixes.Core),
  buffer: prefixWith(Prefixes.Buffer),
  window: prefixWith(Prefixes.Window),
  tabpage: prefixWith(Prefixes.Tabpage),
}

const { notify, request, onEvent } = ConnectMsgpackRPC(workerData.nvimPath)

const registeredEventActions = new Set<string>()
const { state, watchState, onStateChange, onStateValue, untilStateValue } = CreateVimState('main')

const watchers = {
  actions: new EventEmitter(),
  events: new EventEmitter(),
  autocmds: new EventEmitter(),
  bufferEvents: new EventEmitter(),
}

const req = {
  core: onFnCall((name: string, args: any[] = []) => request(prefix.core(name), args)) as Api,
  buf: onFnCall((name: string, args: any[] = []) => request(prefix.buffer(name), args)) as IBuffer,
  win: onFnCall((name: string, args: any[] = []) => request(prefix.window(name), args)) as IWindow,
  tab: onFnCall((name: string, args: any[] = []) => request(prefix.tabpage(name), args)) as ITabpage,
}

const api = {
  core: onFnCall((name: string, args: any[]) => notify(prefix.core(name), args)) as Api,
  buf: onFnCall((name: string, args: any[]) => notify(prefix.buffer(name), args)) as IBuffer,
  win: onFnCall((name: string, args: any[]) => notify(prefix.window(name), args)) as IWindow,
  tab: onFnCall((name: string, args: any[]) => notify(prefix.tabpage(name), args)) as ITabpage,
}

// trying to do dynamic introspection (obj vs arr) messy with typings. (also a bit slower)
const as = {
  buf: (p: Promise<ExtContainer>): Promise<Buffer> => p.then(e => Buffer(e.id)),
  bufl: (p: Promise<ExtContainer[]>): Promise<Buffer[]> => p.then(m => m.map(e => Buffer(e.id))),
  win: (p: Promise<ExtContainer>): Promise<Window> => p.then(e => Window(e.id)),
  winl: (p: Promise<ExtContainer[]>): Promise<Window[]> => p.then(m => m.map(e => Window(e.id))),
  tab: (p: Promise<ExtContainer>): Promise<Tabpage> => p.then(e => Tabpage(e.id)),
  tabl: (p: Promise<ExtContainer[]>): Promise<Tabpage[]> => p.then(m => m.map(e => Tabpage(e.id))),
}

const subscribe = (event: string, fn: (data: any) => void) => {
  onEvent(event, fn)
  api.core.subscribe(event)
}

const options = new Map<string, any>()

const getOption = async (name: string) => {
  const optionValue = await req.core.getOption(name)
  options.set(name, optionValue)
  return optionValue
}

const readonlyOptions: VimOption = new Proxy(Object.create(null), {
  get: (_, key: string) => options.has(key)
  ? Promise.resolve(options.get(key))
  : getOption(key)
})

const cmd = (command: string) => api.core.command(command)
const cmdOut = (command: string) => req.core.commandOutput(command)
const expr = (expression: string) => req.core.eval(expression)
const call: Functions = onFnCall((name, args) => req.core.callFunction(name, args))
const feedkeys = (keys: string, mode = 'm', escapeCSI = false) => req.core.feedkeys(keys, mode, escapeCSI)
const normal = (keys: string) => cmd(`norm! "${keys.replace(/"/g, '\\"')}"`)
const callAtomic = (calls: any[]) => req.core.callAtomic(calls)
const onAction = (event: string, cb: GenericCallback) => {
  watchers.actions.on(event, cb)
  registeredEventActions.add(event)
  cmd(`let g:vn_cmd_completions .= "${event}\\n"`)
}

const getCurrentLine = () => req.core.getCurrentLine()

const getNamedBuffers = async () => {
  const bufs = await buffers.list()
  return Promise.all(bufs.map(async b => ({
    buffer: b,
    name: await b.name,
  })))
}

const loadBuffer = async (file: string): Promise<boolean> => {
  const targetBuffer = await buffers.find(file)
  if (!targetBuffer) return false

  api.core.setCurrentBuf(targetBuffer.id)
  return true
}

type JumpOpts = HyperspaceCoordinates & { openBufferFirst: boolean }

const jumpToPositionInFile = async ({ line, path, column, openBufferFirst }: JumpOpts) => {
  if (openBufferFirst && path) await buffers.open(path)
  // nvim_win_set_cursor params
  // line: 1-index based
  // column: 0-index based
  current.window.setCursor(line + 1, column || 0)
}

const jumpTo = async ({ line, column, path }: HyperspaceCoordinates) => {
  const bufferLoaded = path ? path === state.absoluteFilepath : true
  jumpToPositionInFile({ line, column, path, openBufferFirst: !bufferLoaded })
}

// the reason this method exists is because opening buffers with an absolute path
// will have the abs path in names and buffer lists. idk, it just behaves wierdly
// so it's much easier to open a file realtive to the current project (:cd/:pwd)
// TODO: we should consoldiate these functions and have the function
// smartly determine how to open the buffer in a non-offensive way.
const jumpToProjectFile = async ({ line, column, path }: HyperspaceCoordinates) => {
  const bufferLoaded = path ? path === state.file : true
  jumpToPositionInFile({ line, column, path, openBufferFirst: !bufferLoaded })
}

const systemAction = (event: string, cb: GenericCallback) => watchers.actions.on(event, cb)

const buffers = {
  list: () => as.bufl(req.core.listBufs()),
  open: async (file: string) => {
    const loaded = await loadBuffer(file)
    if (loaded) return true

    cmd(`badd ${file}`)
    return loadBuffer(file)
  },
  find: async (name: string) => {
    const buffers = await getNamedBuffers()
    // it appears that buffers name will have a fullpath, like
    // `/Users/anna/${name}` so we will try to substring match 
    // the end of the name
    const found = buffers.find(b => b.name.endsWith(name)) || {} as any
    return found.buffer
  },
  add: async (name: string) => {
    const id = uuid()
    cmd(`badd ${id}`)

    const buffer = await buffers.find(id)
    if (!buffer) throw new Error(`addBuffer: could not find buffer '${id}' added with :badd ${name}`)

    // for some reason, buf.setName creates a new buffer? lolwut?
    // so it's probably still better to do the shenanigans above
    // since finding the buffer by uuid is more accurate instead
    // of trying to get a buffer handle by name only alone
    //
    // after a future neovim PR we might consider using 'nvim_create_buf'
    await buffer.setName(name)
    cmd(`bwipeout! ${id}`)
    return buffer
  },
  listWithInfo: async (): Promise<BufferInfo[]> => {
    const bufs = await buffers.list()
    const currentBufferId = current.buffer.id

    const bufInfo = await Promise.all(bufs.map(async b => ({
      name: await b.name,
      current: b.id === currentBufferId,
      modified: await b.getOption(BufferOption.Modified),
      listed: await b.getOption(BufferOption.Listed),
      terminal: (await b.getOption(BufferOption.Type)) === BufferType.Terminal,
    })))

    if (!bufInfo) return []

    return bufInfo
      .filter(m => m.listed && !m.current)
      .map(({ name, modified, terminal }) => ({
        name,
        modified,
        terminal,
        base: basename(name),
        dir: simplifyPath(dirname(name), state.cwd)
      }))
      .map((m, ix, arr) => ({ ...m, duplicate: arr.some((n, ixf) => ixf !== ix && n.base === m.base) }))
      .map(m => ({ ...m, name: m.duplicate ? `${m.dir}/${m.base}` : m.base }))
  },
  addShadow: async (name: string) => {
    const buffer = await buffers.add(name)

    buffer.setOption(BufferOption.Type, BufferType.NonFile)
    buffer.setOption(BufferOption.Hidden, BufferHide.Hide)
    buffer.setOption(BufferOption.Listed, false)
    buffer.setOption(BufferOption.Modifiable, false)
    buffer.setOption(BufferOption.Filetype, 'veonim-shadow-buffer')

    return buffer
  },
}

const windows = {
  list: () => as.winl(req.core.listWins()),
}

const tabs = {
  list: () => as.tabl(req.core.listTabpages()),
}

const isFunc = (m: any) => is.function(m) || is.asyncfunction(m)

const current = {
  get cursor() {
    return {
      row: state.line - state.editorTopLine,
      col: state.column
    }
  },
  get buffer(): Buffer {
    const promise = as.buf(req.core.getCurrentBuf())

    return onProp<Buffer>(prop => {
      const testValue = Reflect.get(dummy.buf, prop)
      if (testValue == null) throw new TypeError(`${prop as string} does not exist on Neovim.Buffer`)
      return isFunc(testValue)
        ? async (...args: any[]) => Reflect.get(await promise, prop)(...args)
        : promise.then(m => Reflect.get(m, prop))
    })
  },
  get window(): Window {
    const promise = as.win(req.core.getCurrentWin())

    return onProp<Window>(prop => {
      const testValue = Reflect.get(dummy.win, prop)
      if (testValue == null) throw new TypeError(`${prop as string} does not exist on Neovim.Window`)
      return isFunc(testValue)
        ? async (...args: any[]) => Reflect.get(await promise, prop)(...args)
        : promise.then(m => Reflect.get(m, prop))
    })
  },
  get tabpage(): Tabpage {
    const promise = as.tab(req.core.getCurrentTabpage())

    return onProp<Tabpage>(prop => {
      const testValue = Reflect.get(dummy.tab, prop)
      if (testValue == null) throw new TypeError(`${prop as string} does not exist on Neovim.Tabpage`)
      return isFunc(testValue)
        ? async (...args: any[]) => Reflect.get(await promise, prop)(...args)
        : promise.then(m => Reflect.get(m, prop))
    })
  },
}

const emptyObject: { [index: string]: any } = Object.create(null)
const g = new Proxy(emptyObject, {
  get: async (_t, name: string) => {
    const val = await req.core.getVar(name as string).catch(e => e)
    const err = is.array(val) && is.string(val[1]) && /Key (.*?)not found/.test(val[1])
    return err ? undefined : val
  },
  set: (_t, name: string, val: any) => (api.core.setVar(name, val), true),
})

type RegisterAutocmd = { [Key in Autocmds]: (fn: (...arg: any[]) => void) => void | any }
const autocmd: RegisterAutocmd = new Proxy(Object.create(null), {
  get: (_, event: Autocmds) => (fn: any) => watchers.autocmds.on(event, fn)
})

type BufferEvents = keyof BufferEvent
type RemoveListener = () => void
type OnEvent = { [Key in BufferEvents]: (fn: (value: BufferEvent[Key]) => void) => RemoveListener }
const on: OnEvent = new Proxy(Object.create(null), {
  get: (_, event: BufferEvents) => (fn: any) => watchers.events.on(event, fn)
})

type UntilEvent = { [Key in BufferEvents]: Promise<void> }
const untilEvent: UntilEvent = new Proxy(Object.create(null), {
  get: (_, event: BufferEvents) => new Promise(done => {
    watchers.events.once(event, done)
  })
})

const applyPatches = async (patches: Patch[]) => {
  const bufs = await Promise.all((await buffers.list()).map(async buffer => ({
    buffer,
    path: await buffer.name,
  })))

  // TODO: this assumes all missing files are in the cwd
  // TODO: badd allows the option of specifying a line number to position the curosr
  // when loading the buffer. might be nice to use on a rename op. see :h badd

  // TODO: we should notify user that other files were changed
  patches
    .filter(p => bufs.some(b => b.path !== p.path))
    .forEach(b => cmd(`badd ${b.file}`))

  applyPatchesToBuffers(patches, bufs)
}

interface PathBuf { buffer: Buffer, path: string }
const applyPatchesToBuffers = async (patches: Patch[], buffers: PathBuf[]) => buffers.forEach(({ buffer, path }) => {
  const patch = patches.find(p => p.path === path)
  if (!patch) return

  patch.operations.forEach(async ({ op, start, end, val }, ix) => {
    if (op === 'delete') buffer.delete(start.line)
    else if (op === 'append') buffer.append(start.line, val)
    else if (op === 'replace') {
      const targetLine = await buffer.getLine(start.line)
      const newLine = targetLine.slice(0, start.character) + val + targetLine.slice(end.character)
      buffer.replace(start.line, newLine)
    }

    if (!ix) cmd('undojoin')
  })
})

const refreshState = async () => {
  const nextState = await call.VeonimState()
  Object.assign(state, nextState)
}

// keeping this per instance of nvim, because i think it is reasonable to
// expect that the same document filepath could have different filetypes in
// different vim instances
const documentFiletypes = new Map<number, string>()
const registerFiletype = ((bufnr: number, filetype: string) => {
  documentFiletypes.set(bufnr, filetype)
})

const events = [...registeredEventActions.values()].join('\\n')
cmd(`let g:vn_cmd_completions .= "${events}\\n"`)

subscribe('veonim', ([ event, args = [] ]) => watchers.actions.emit(event, ...args))
subscribe('veonim-state', ([ nextState ]) => Object.assign(state, nextState))
subscribe('veonim-position', ([ position ]) => Object.assign(state, position))
subscribe('veonim-autocmd', ([ autocmd, ...arg ]) => {
  // TODO: should really provide a way to scope autocmds to the current vim instance...
  if (autocmd === 'FileType') registerFiletype(arg[0], arg[1])
  watchers.autocmds.emit(autocmd, ...arg)
})

onEvent('nvim_buf_detach_event', (args: any[]) => {
  watchers.bufferEvents.emit(`detach:${args[0].id}`)
})

onEvent('nvim_buf_changedtick_event', (args: any[]) => {
  const [ extContainerData, changedTick ] = args
  const bufId = extContainerData.id
  watchers.bufferEvents.emit(`changedtick:${bufId}`, changedTick)
})

onEvent('nvim_buf_lines_event', (args: any[]) => {
  const [ extContainerData, changedTick, firstLine, lastLine, lineData, more ] = args
  const bufId = extContainerData.id

  watchers.bufferEvents.emit(`change:${bufId}`, {
    filetype: documentFiletypes.get(bufId),
    changedTick,
    firstLine,
    lastLine,
    lineData,
    more,
  })
})

refreshState()
watchers.events.emit('bufLoad')

autocmd.CompleteDone(word => watchers.events.emit('completion', word))
autocmd.CursorMoved(() => watchers.events.emit('cursorMove'))
autocmd.CursorMovedI(() => watchers.events.emit('cursorMoveInsert'))
autocmd.BufAdd(bufId => watchers.events.emit('bufOpen', Buffer(bufId-0)))
autocmd.BufEnter(bufId => watchers.events.emit('bufLoad', Buffer(bufId-0)))
autocmd.BufWritePre(bufId => watchers.events.emit('bufWritePre', Buffer(bufId-0)))
autocmd.BufWritePost(bufId => watchers.events.emit('bufWrite', Buffer(bufId-0)))
autocmd.BufWipeout(bufId => watchers.events.emit('bufClose', Buffer(bufId-0)))
autocmd.InsertEnter(() => watchers.events.emit('insertEnter'))
autocmd.InsertLeave(() => watchers.events.emit('insertLeave'))
autocmd.OptionSet((name: string, value: any) => options.set(name, value))
autocmd.FileType((_, filetype: string) => watchers.events.emit('filetype', filetype))
autocmd.SourcePre(sourcedFile => watchers.events.emit('vimrcLoad', sourcedFile))

autocmd.TextChanged(revision => {
  state.revision = revision-0
  watchers.events.emit('bufChange', current.buffer)
})

autocmd.TextChangedI(revision => {
  state.revision = revision-0
  watchers.events.emit('bufChangeInsert', current.buffer)
})

// TODO: i think we should just determine this from render events
autocmd.WinEnter((id: number) => watchers.events.emit('winEnter', id))

const onVimrcLoad = (fn: (file: string) => void) => watchers.events.on('vimrcLoad', fn)

const HL_CLR = 'nvim_buf_clear_highlight'
const HL_ADD = 'nvim_buf_add_highlight'

const Buffer = (id: any) => ({
  id,
  get number() { return req.buf.getNumber(id) },
  get valid() { return req.buf.isValid(id) },
  get name() { return req.buf.getName(id) },
  get length() { return req.buf.lineCount(id) },
  get changedtick() { return req.buf.getChangedtick(id) },
  attach: ({ sendInitialBuffer }, cb) => {
    watchers.bufferEvents.on(`change:${id}`, cb)
    req.buf.attach(id, sendInitialBuffer, {}).then(attached => {
      if (!attached) return console.error('could not attach to buffer:', id)
    })
    watchers.bufferEvents.once(`detach:${id}`, () => {
      watchers.bufferEvents.removeListener(`change:${id}`, cb)
    })
  },
  onChangedTick: onChangedTickFn => {
    watchers.bufferEvents.on(`changedtick:${id}`, onChangedTickFn)
    watchers.bufferEvents.once(`detach:${id}`, () => {
      watchers.bufferEvents.removeListener(`changedtick:${id}`, onChangedTickFn)
    })
  },
  onDetach: onDetachFn => {
    watchers.bufferEvents.once(`detach:${id}`, onDetachFn)
  },
  detach: () => {
    watchers.bufferEvents.removeAllListeners(`change:${id}`)
    req.buf.detach(id).then(detached => {
      if (!detached) console.error('could not detach from buffer:', id)
    })
  },
  append: async (start, lines) => {
    const replacement = is.array(lines) ? lines as string[] : [lines as string]
    const linesBelow = await req.buf.getLines(id, start + 1, -1, false)
    const newLines = [...replacement, ...linesBelow]

    api.buf.setLines(id, start + 1, start + 1 + newLines.length, false, newLines)
  },
  getAllLines: () => req.buf.getLines(id, 0, -1, true),
  getLines: (start, end) => req.buf.getLines(id, start, end, true),
  getLine: start => req.buf.getLines(id, start, start + 1, true).then(m => m[0]),
  setLines: (start, end, lines) => api.buf.setLines(id, start, end, true, lines),
  delete: start => api.buf.setLines(id, start, start + 1, true, []),
  replace: (start, line) => api.buf.setLines(id, start, start + 1, false, [ line ]),
  getVar: name => req.buf.getVar(id, name),
  setVar: (name, value) => api.buf.setVar(id, name, value),
  getKeymap: mode => req.buf.getKeymap(id, mode),
  delVar: name => api.buf.delVar(id, name),
  getOption: name => req.buf.getOption(id, name),
  setOption: (name, value) => api.buf.setOption(id, name, value),
  setName: name => api.buf.setName(id, name),
  getMark: name => req.buf.getMark(id, name),
  addHighlight: (sourceId, hlGroup, line, colStart, colEnd) => req.buf.addHighlight(id, sourceId, hlGroup, line, colStart, colEnd),
  clearHighlight: (sourceId, lineStart, lineEnd) => api.buf.clearHighlight(id, sourceId, lineStart, lineEnd),
  clearAllHighlights: () => api.buf.clearHighlight(id, -1, 0, -1),
  highlightProblems: async problems => callAtomic([
    [HL_CLR, [id, problems[0].id, 0, -1]],
    ...problems.map(p => [HL_ADD, [id, p.id, p.group, p.line, p.columnStart, p.columnEnd]]),
  ]),
} as Buffer)

const Window = (id: any) => ({
  id,
  get number() { return req.win.getNumber(id) },
  get valid() { return req.win.isValid(id) },
  get tab() { return as.tab(req.win.getTabpage(id)) },
  get buffer() { return as.buf(req.win.getBuf(id)) },
  get cursor() { return req.win.getCursor(id) },
  get position() { return req.win.getPosition(id) },
  get height() { return req.win.getHeight(id) },
  get width() { return req.win.getWidth(id) },
  setCursor: (row, col) => api.win.setCursor(id, [ row, col ]),
  setHeight: height => api.win.setHeight(id, height),
  setWidth: width => api.win.setWidth(id, width),
  getVar: name => req.win.getVar(id, name),
  setVar: (name, val) => api.win.setVar(id, name, val),
  delVar: name => api.win.delVar(id, name),
  getOption: name => req.win.getOption(id, name),
  setOption: (name, val) => api.win.setOption(id, name, val),
} as Window)

const Tabpage = (id: any) => ({
  id,
  get number() { return req.tab.getNumber(id) },
  get valid() { return req.tab.isValid(id) },
  get window() { return as.win(req.tab.getWin(id)) },
  get windows() { return as.winl(req.tab.listWins(id)) },
  getVar: name => req.tab.getVar(id, name),
  setVar: (name, val) => api.tab.setVar(id, name, val),
  delVar: name => api.tab.delVar(id, name),
} as Tabpage)

const dummy = {
  win: Window(0),
  buf: Buffer(0),
  tab: Tabpage(0),
}

const exportAPI = { state, watchState, onStateChange, onStateValue, untilStateValue,
  cmd, cmdOut, expr, call, feedkeys, normal, callAtomic, onAction,
  getCurrentLine, jumpTo, jumpToProjectFile, systemAction, current,
  g, on, untilEvent, applyPatches, buffers, windows, tabs, options: readonlyOptions, onVimrcLoad }

export default exportAPI
export type NeovimAPI = typeof exportAPI
