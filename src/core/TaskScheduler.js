/**
 * Lightweight async task pool with deterministic long-task isolation metadata.
 *
 * It keeps the existing coroutine `TaskManager` intact while offering a modern
 * promise-based API for build, streaming, and worker-adjacent jobs.
 *
 * @example
 * const scheduler = new TaskScheduler({ timeoutMs: 50 });
 * scheduler.submit(() => loadChunk('0:0'), { name: 'chunk-load' });
 * const results = await scheduler.waitAll();
 */
export class TaskScheduler {
  constructor({
    timeoutMs = 50,
    now = defaultNow,
    onIsolate = null
  } = {}) {
    this.timeoutMs = Math.max(0, Number(timeoutMs) || 0);
    this.now = typeof now === 'function' ? now : defaultNow;
    this.onIsolate = onIsolate;
    this.pending = [];
    this.isolatedTasks = [];
    this.sequence = 0;
  }

  /**
   * Submit a task to the scheduler.
   *
   * @param {Function|Promise|*} task Task function, promise, or immediate value.
   * @param {object} options Task metadata.
   * @returns {Promise<object>} Settled result with duration and isolation flags.
   */
  submit(task, { name = null, payload = undefined, metadata = {} } = {}) {
    const id = this.sequence;
    this.sequence += 1;
    const taskName = name || `task-${id}`;
    const promise = Promise.resolve().then(() => {
      const startedAt = this.now();
      try {
        const value = typeof task === 'function' ? task(payload) : task;
        if (value && typeof value.then === 'function') {
          return value.then(
            (resolved) => this._settle({
              id,
              name: taskName,
              status: 'fulfilled',
              value: resolved,
              metadata,
              startedAt
            }),
            (error) => this._settle({
              id,
              name: taskName,
              status: 'rejected',
              reason: error,
              metadata,
              startedAt
            })
          );
        }
        return this._settle({
          id,
          name: taskName,
          status: 'fulfilled',
          value,
          metadata,
          startedAt
        });
      } catch (error) {
        return this._settle({
          id,
          name: taskName,
          status: 'rejected',
          reason: error,
          metadata,
          startedAt
        });
      }
    });
    this.pending.push(promise);
    return promise;
  }

  /**
   * Await every task submitted since the previous waitAll call.
   *
   * @returns {Promise<object[]>} Settled task records.
   */
  async waitAll() {
    const pending = this.pending.splice(0);
    return Promise.all(pending);
  }

  clear() {
    this.pending.length = 0;
    this.isolatedTasks.length = 0;
  }

  _settle(record) {
    const completedAt = this.now();
    const durationMs = Math.max(0, completedAt - record.startedAt);
    const isolated = this.timeoutMs > 0 && durationMs > this.timeoutMs;
    const result = {
      id: record.id,
      name: record.name,
      status: record.status,
      durationMs,
      isolated,
      metadata: record.metadata
    };
    if (record.status === 'fulfilled') result.value = record.value;
    else result.reason = record.reason;
    if (isolated) {
      this.isolatedTasks.push(result);
      this.onIsolate?.(result);
    }
    return result;
  }
}

function defaultNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export default TaskScheduler;
