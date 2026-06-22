import WorkerManager from './WorkerManager.js';

const TASKS = {
  pathfinding: { lane: 'logic', workerTask: 'astar' },
  collision: { lane: 'physics', workerTask: 'batchCollisions' },
  resource: { lane: 'loading', workerTask: 'resource' },
  ai: { lane: 'ai', workerTask: 'ai' }
};

function uniqueLanes(tasks) {
  const seen = new Set();
  const lanes = [];
  for (const taskName of tasks) {
    const lane = TASKS[taskName]?.lane || 'logic';
    if (seen.has(lane)) continue;
    seen.add(lane);
    lanes.push({
      name: lane,
      tasks: tasks.filter((task) => (TASKS[task]?.lane || 'logic') === lane)
    });
  }
  return lanes;
}

/**
 * Worker lane dispatcher for heavyweight runtime jobs.
 */
export class WorkerTaskScheduler {
  constructor({ workerManager = null, workerFactory = null } = {}) {
    this.workerManager = workerManager || new WorkerManager({ workerFactory }).registerBuiltins();
    this.workerFactory = this.workerManager.workerFactory || workerFactory || null;
    this.history = [];
    this._registerFallbackTasks();
  }

  async dispatch(taskName, payload = {}, options = {}) {
    const definition = TASKS[taskName] || { lane: 'logic', workerTask: taskName };
    const startedAt = Date.now();
    const value = await this.workerManager.run(definition.workerTask, payload, options);
    const result = {
      task: taskName,
      workerTask: definition.workerTask,
      lane: definition.lane,
      offMainThread: Boolean(this.workerFactory),
      durationMs: Math.max(0, Date.now() - startedAt),
      value
    };
    this.history.push(result);
    return result;
  }

  plan(tasks = []) {
    const normalized = tasks.map((task) => String(task));
    return {
      format: 'OmniCore.WorkerTaskPlan',
      lanes: uniqueLanes(normalized),
      fallback: this.workerFactory ? 'worker' : 'main-thread',
      tasks: normalized
    };
  }

  report() {
    return {
      format: 'OmniCore.WorkerTaskScheduler',
      dispatched: this.history.length,
      offMainThread: Boolean(this.workerFactory),
      history: [...this.history]
    };
  }

  _registerFallbackTasks() {
    if (!this.workerManager.tasks?.has?.('resource')) {
      this.workerManager.register('resource', ({ assets = [] }) => assets.map((asset) => ({
        ...asset,
        scheduled: true
      })));
    }
    if (!this.workerManager.tasks?.has?.('ai')) {
      this.workerManager.register('ai', ({ agents = [] }) => agents.map((agent) => ({
        ...agent,
        decision: agent.decision || 'idle'
      })));
    }
  }
}

export default WorkerTaskScheduler;
