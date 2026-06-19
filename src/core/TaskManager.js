import { createOmniError } from './OmniError.js';

/**
 * Generator-based coroutine task runner using an independent timer loop.
 *
 * @example
 * OmniCore.Task.start(function* showThenHide() {
 *   yield OmniCore.Task.wait(2000);
 *   button.visible = true;
 *   yield OmniCore.Task.wait(1000);
 *   button.visible = false;
 * });
 */
export class TaskManager {
  constructor({
    interval = 1,
    now = () => Date.now(),
    setTimer = (handler, delay) => setTimeout(handler, delay),
    clearTimer = (handle) => clearTimeout(handle)
  } = {}) {
    this.interval = Math.max(1, Number(interval) || 1);
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.tasks = new Set();
    this.timer = null;
    this.running = false;
    this._boundTick = () => this._tick();
  }

  /**
   * Starts a generator coroutine.
   *
   * @param {Function|Iterator} generator Generator function or iterator.
   * @returns {object} Task handle with cancel() and completion state.
   */
  start(generator) {
    const iterator = typeof generator === 'function' ? generator() : generator;
    if (!iterator || typeof iterator.next !== 'function') {
      throw createOmniError('Task', 'Task.start(generator) requires a generator function or iterator.');
    }

    const handle = {
      iterator,
      waitUntil: this.now(),
      waiting: false,
      done: false,
      cancelled: false,
      result: undefined,
      error: null,
      cancel: () => {
        handle.cancelled = true;
        this.tasks.delete(handle);
        this._stopIfIdle();
        return handle;
      }
    };

    this.tasks.add(handle);
    this._resume(handle);
    this._ensureLoop();
    return handle;
  }

  /**
   * Creates a wait token for coroutine yields.
   *
   * @param {number} ms Milliseconds to suspend the current coroutine.
   * @returns {{type: string, ms: number}} Wait token.
   */
  wait(ms) {
    return {
      type: 'omnicore:task-wait',
      ms: Math.max(0, Number(ms) || 0)
    };
  }

  clear() {
    for (const task of this.tasks) task.cancelled = true;
    this.tasks.clear();
    if (this.timer != null) this.clearTimer(this.timer);
    this.timer = null;
    this.running = false;
  }

  _ensureLoop() {
    if (this.running || this.tasks.size === 0) return;
    this.running = true;
    this._scheduleNext();
  }

  _scheduleNext() {
    if (this.tasks.size === 0) {
      this.running = false;
      this.timer = null;
      return;
    }
    this.timer = this.setTimer(this._boundTick, this._nextDelay());
    this.timer?.unref?.();
  }

  _nextDelay() {
    let nextDue = Infinity;
    for (const task of this.tasks) {
      if (!task.waiting) return 0;
      nextDue = Math.min(nextDue, task.waitUntil);
    }
    if (!Number.isFinite(nextDue)) return this.interval;
    return Math.max(0, Math.min(this.interval, Math.ceil(nextDue - this.now())));
  }

  _tick() {
    this.timer = null;
    const current = this.now();
    for (const task of [...this.tasks]) {
      if (task.cancelled || task.done) {
        this.tasks.delete(task);
        continue;
      }
      if (!task.waiting || task.waitUntil <= current) this._resume(task);
    }
    this._scheduleNext();
  }

  _resume(task, input = undefined, isError = false) {
    if (task.cancelled || task.done) return;

    try {
      const step = isError ? task.iterator.throw(input) : task.iterator.next(input);
      if (step.done) {
        task.done = true;
        task.result = step.value;
        this.tasks.delete(task);
        this._stopIfIdle();
        return;
      }
      this._suspend(task, step.value);
    } catch (error) {
      task.done = true;
      task.error = error;
      this.tasks.delete(task);
      this._stopIfIdle();
    }
  }

  _suspend(task, yielded) {
    if (isWaitToken(yielded)) {
      task.waiting = true;
      task.waitUntil = this.now() + yielded.ms;
      return;
    }

    if (yielded && typeof yielded.then === 'function') {
      task.waiting = true;
      task.waitUntil = Infinity;
      yielded.then(
        (value) => {
          task.waiting = false;
          this._resume(task, value, false);
          this._ensureLoop();
        },
        (error) => {
          task.waiting = false;
          this._resume(task, error, true);
          this._ensureLoop();
        }
      );
      return;
    }

    task.waiting = true;
    task.waitUntil = this.now();
  }

  _stopIfIdle() {
    if (this.tasks.size > 0) return;
    if (this.timer != null) this.clearTimer(this.timer);
    this.timer = null;
    this.running = false;
  }
}

function isWaitToken(value) {
  return value?.type === 'omnicore:task-wait';
}

const Task = new TaskManager();

export { Task };
export default Task;
