import { Watcher, MapSetter } from '../support/utils'
import * as vsc from 'vscode'

interface Events {
  didStartTask: vsc.TaskStartEvent
  didEndTask: vsc.TaskEndEvent
  didStartTaskProcess: vsc.TaskProcessStartEvent
  didEndTaskProcess: vsc.TaskProcessEndEvent
}

interface MetaTask extends vsc.Task {
  type: string
}

const activeTasks = new Set<vsc.TaskExecution>()
const registeredTasks = new Set<MetaTask>()
const watchers = Watcher<Events>()
const taskProviders = new MapSetter<string, vsc.TaskProvider>()

// TODO: determine when we need to call the task providers and register the tasks
// looking at vscode it seems to be called when the task list is called upon in
// the UI by either user action or implicit thru build/run/unTests vscode functionality
// see here: https://github.com/Microsoft/vscode/blob/master/src/vs/workbench/contrib/tasks/electron-browser/task.contribution.ts (getGroupedTasks)
// const provideTasksAndRegister = async (type: string, provider: vsc.TaskProvider) => {
//   const providedTasks = (await provider.provideTasks()) || []
//   providedTasks.forEach(task => registeredTasks.add(Object.assign(task, { type })))
// }

const runTask = (task: vsc.Task): vsc.TaskExecution => {
  const terminate = () => {
    console.warn('NYI: terminate running task')
    watchers.emit('didEndTask', { execution: taskExec })
    activeTasks.delete(taskExec)
  }

  // TODO: actually start the task
  // start the task process and stuff
  // emit taskstartprocess and taskendprocess events

  const taskExec = { task, terminate }
  activeTasks.add(taskExec)
  watchers.emit('didStartTask', { execution: taskExec })

  return taskExec
}

const tasks: typeof vsc.tasks = {
  get taskExecutions() {
    return [...activeTasks]
  },

  onDidStartTask: (fn, thisArg) => ({
    dispose: watchers.on('didStartTask', fn.bind(thisArg)),
  }),
  onDidEndTask: (fn, thisArg) => ({
    dispose: watchers.on('didEndTask', fn.bind(thisArg)),
  }),
  onDidStartTaskProcess: (fn, thisArg) => ({
    dispose: watchers.on('didStartTaskProcess', fn.bind(thisArg)),
  }),
  onDidEndTaskProcess: (fn, thisArg) => ({
    dispose: watchers.on('didEndTaskProcess', fn.bind(thisArg)),
  }),

  registerTaskProvider: (type, provider) => {
    taskProviders.add(type, provider)
    // TODO: when do we resolve a task?
    return {
      dispose: () => console.warn('NYI: remove registered task provider'),
    }
  },

  fetchTasks: async (filter = {}) => {
    const filterQuery = filter.type
    // TODO: get tasks from tasks.json (this will be an async op)
    const tasksFromJson: MetaTask[] = []
    return [...registeredTasks, ...tasksFromJson].filter(
      (mt) => mt.type === filterQuery
    )
  },

  executeTask: async (task) => runTask(task),
}

export default tasks
