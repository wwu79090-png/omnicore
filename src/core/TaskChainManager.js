export class TaskChainManager {
  static CONTINUE = 'continue';

  static DONE = 'done';

  static AGAIN = 'again';

  constructor() {
    this.tasks = new Map();
    this.clock = 0;
  }

  add(fn, name = `task-${this.tasks.size + 1}`) {
    this.tasks.set(String(name), createTask(String(name), fn));
    return this;
  }

  doLater(delay, fn, name = `task-${this.tasks.size + 1}`) {
    const task = createTask(String(name), fn);
    task.delay = Number(delay || 0);
    task.sleepUntil = this.clock + task.delay;
    this.tasks.set(task.name, task);
    return this;
  }

  remove(name) {
    this.tasks.delete(String(name));
    return this;
  }

  step(dt = 0) {
    this.clock += Number(dt || 0);
    const completed = [];
    for (const task of [...this.tasks.values()]) {
      if (this.clock < task.sleepUntil) continue;
      task.elapsed += Number(dt || 0);
      const status = task.fn(task);
      if (status === TaskChainManager.DONE) {
        completed.push(task.name);
        this.tasks.delete(task.name);
      } else if (status === TaskChainManager.AGAIN) {
        task.sleepUntil = this.clock + task.delay;
      }
    }
    return {
      time: this.clock,
      completed,
      active: [...this.tasks.keys()].sort()
    };
  }
}

function createTask(name, fn) {
  return {
    name,
    fn,
    elapsed: 0,
    delay: 0,
    sleepUntil: 0
  };
}

export default TaskChainManager;
