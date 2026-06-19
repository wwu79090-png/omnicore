import { createOmniError, toOmniError } from '../core/OmniError.js';

/**
 * Worker task facade with main-thread fallback.
 *
 * @example
 * const worker = new WorkerManager();
 * worker.register('sum', ({ values }) => values.reduce((a, b) => a + b, 0));
 * await worker.run('sum', { values: [1, 2, 3] });
 */
export class WorkerManager {
  constructor({ workerFactory = defaultWorkerFactory, watchdogMs = 5000, events = null } = {}) {
    this.workerFactory = workerFactory;
    this.watchdogMs = watchdogMs;
    this.events = events;
    this.tasks = new Map();
    this.serializers = new Map();
    this.pending = new Map();
    this.syncSubscriptions = [];
    this.worker = null;
    this.workerTerminated = false;
    this.nextId = 1;
  }

  register(name, handler, { pure = true } = {}) {
    if (typeof handler !== 'function') throw createOmniError('Worker', `任务必须是函数：${name}`);
    this.tasks.set(name, {
      handler,
      source: serializeHandler(handler),
      isPayloadSerializable: isSerializablePayload,
      pure: pure !== false
    });
    return this;
  }

  registerBuiltins() {
    this.register('astar', astarTask);
    this.register('batchCollisions', batchCollisionsTask);
    this.register('mapPaths', mapPathsTask);
    return this;
  }

  async run(name, payload = {}, options = {}) {
    const task = this.tasks.get(name);
    if (!task) throw createOmniError('Worker', `任务尚未注册：${name}`);
    if (task.pure === false || !task.isPayloadSerializable(payload)) {
      const result = task.handler(payload);
      if (result && typeof result.then === 'function') return result;
      return result;
    }
    if (!this.workerFactory) {
      try {
        return await task.handler(payload);
      } catch (error) {
        throw toOmniError(error, { module: 'Worker', message: `任务执行失败：${name}` });
      }
    }
    return this._runInWorker(name, payload, task, options);
  }

  destroy() {
    const error = createOmniError('Worker', 'WorkerManager 已销毁，任务未完成。');
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    for (const off of this.syncSubscriptions) off?.();
    this.syncSubscriptions.length = 0;
    this.worker?.terminate?.();
    this.workerTerminated = true;
    this.worker = null;
  }

  async runSynced(name, payload = {}, { store = null, key = name, input = [], options = {} } = {}) {
    const taskPayload = this._payloadFromStore(payload, store, input);
    const result = await this.run(name, taskPayload, options);
    store?.set?.(key, result);
    this.events?.emit?.('worker:sync', { task: name, key, payload: taskPayload, result });
    return result;
  }

  _payloadFromStore(payload, store, input) {
    if (!store || !input?.length) return payload;
    const nextPayload = { ...payload };
    for (const key of input) {
      if (Object.prototype.hasOwnProperty.call(nextPayload, key)) continue;
      nextPayload[key] = store.get(key);
    }
    return nextPayload;
  }

  sync(store, keys = []) {
    const worker = this._ensureWorker();
    if (!worker) return () => {};
    for (const key of keys) {
      if (store?.get) this._postSync(worker, key, store.get(key));
      const off = store?.subscribe?.(key, (value) => this._postSync(this._ensureWorker(), key, value));
      if (off) this.syncSubscriptions.push(off);
    }
    return () => {
      for (const off of this.syncSubscriptions.splice(0)) off?.();
    };
  }

  createSharedBuffer({ name = 'shared', length = 1024, ArrayType = Float32Array } = {}) {
    const dataBytes = Math.max(1, Number(length) || 1) * ArrayType.BYTES_PER_ELEMENT;
    const shared = typeof SharedArrayBuffer !== 'undefined';
    const BufferCtor = shared ? SharedArrayBuffer : ArrayBuffer;
    const buffer = new BufferCtor(dataBytes);
    const control = new BufferCtor(Int32Array.BYTES_PER_ELEMENT * 4);
    return {
      name,
      length: Math.max(1, Number(length) || 1),
      shared,
      buffer,
      control,
      view: new ArrayType(buffer),
      state: new Int32Array(control),
      ArrayType
    };
  }

  syncSharedBuffer(name, channel) {
    const worker = this._ensureWorker();
    if (!worker?.postMessage || !channel) return false;
    worker.postMessage({
      type: 'shared-buffer',
      name,
      length: channel.length,
      shared: channel.shared,
      buffer: channel.buffer,
      control: channel.control
    });
    this.events?.emit?.('worker:shared-buffer-sync', { name, length: channel.length, shared: channel.shared });
    return true;
  }

  writeSharedFrame(channel, values = [], { offset = 0 } = {}) {
    if (!channel?.view || !channel?.state) throw createOmniError('Worker', 'Shared buffer channel is invalid.');
    const start = Math.max(0, Number(offset) || 0);
    const limit = Math.min(channel.view.length - start, values.length);
    for (let index = 0; index < limit; index += 1) {
      channel.view[start + index] = Number(values[index]) || 0;
    }
    storeInt(channel, 1, start);
    storeInt(channel, 2, limit);
    const version = addInt(channel, 0, 1);
    storeInt(channel, 3, Math.trunc(Date.now() % 2147483648));
    return version;
  }

  readSharedFrame(channel) {
    if (!channel?.view || !channel?.state) throw createOmniError('Worker', 'Shared buffer channel is invalid.');
    const version = loadInt(channel, 0);
    const offset = loadInt(channel, 1);
    const length = loadInt(channel, 2);
    return {
      name: channel.name,
      version,
      offset,
      length,
      values: Array.from(channel.view)
    };
  }

  _postSync(worker, key, value) {
    if (!worker || typeof worker.postMessage !== 'function') return;
    worker?.postMessage?.({ type: 'sync', key, value });
    this.events?.emit?.('worker:store-sync', { key, value });
  }

  _runInWorker(name, payload, task, options = {}) {
    const worker = this._ensureWorker();
    if (!worker || typeof worker.postMessage !== 'function') return Promise.resolve(task.handler(payload));
    const id = this.nextId;
    this.nextId += 1;

    return new Promise((resolve, reject) => {
      const watchdogMs = options.watchdogMs ?? this.watchdogMs;
      const timer = watchdogMs > 0
        ? setTimeout(() => this._timeoutTask(id, name, watchdogMs), watchdogMs)
        : null;
      this.pending.set(id, {
        resolve,
        reject,
        handler: task.handler,
        taskName: name,
        timer
      });
      try {
        const taskDescriptor = this.serializers.get(name) || this._registerTaskInWorker(worker, name, task.source);
        worker.postMessage({
          id,
          type: 'task',
          name,
          task: taskDescriptor,
          payload,
          watchdogMs
        });
      } catch (error) {
        this._clearPending(id);
        Promise.resolve()
          .then(() => task.handler(payload))
          .then(resolve, reject);
      }
    });
  }

  _ensureWorker() {
    if (this.worker && !this.workerTerminated) return this.worker;
    try {
      this.worker = this.workerFactory?.();
      this.workerTerminated = false;
      if (!this.worker) return null;
      this.worker.onmessage = (event) => {
        const payload = event.data || {};
        const { type, id, result, error } = payload;
        if (type === 'sync') return;
        const pending = this.pending.get(id);
        if (!pending) return;
        this._clearPending(id);
        if (error) pending.reject(createOmniError('Worker', String(error)));
        else pending.resolve(result);
      };
      this.worker.onerror = (error) => {
        this._resetWorker(toOmniError(error, { module: 'Worker', message: 'Worker 运行出错，已重置。' }));
      };
      this.worker.onmessageerror = (error) => {
        this._resetWorker(createOmniError('Worker', 'Worker 消息错误。', { cause: error }));
      };
      return this.worker;
    } catch {
      this.worker = null;
      return null;
    }
  }

  _clearPending(id) {
    const pending = this.pending.get(id);
    if (pending) clearTimeout(pending.timer);
    this.pending.delete(id);
    return pending;
  }

  _timeoutTask(id, name, watchdogMs) {
    const pending = this._clearPending(id);
    if (!pending) return;
    const timeoutError = createOmniError('Worker', `任务超时：${name}，超过 ${watchdogMs}ms。`);
    this._broadcastPending(timeoutError);
    this.worker?.terminate?.();
    this.workerTerminated = true;
    this.serializers.clear();
    pending.reject(timeoutError);
  }

  _registerTaskInWorker(worker, name, source) {
    this.serializers.set(name, source);
    return source;
  }

  _resetWorker(error) {
    this.workerTerminated = true;
    if (this.worker) {
      this.worker.terminate?.();
      this.worker = null;
    }
    this.serializers.clear();
    if (error) this._broadcastPending(error);
  }

  _broadcastPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject?.(error);
    }
    this.pending.clear();
  }

  _buildPayload(payload) {
    return payload && typeof payload === 'object'
      ? { ...payload }
      : { value: payload };
  }

  static astar({ start, goal, grid }) {
    return astarTask({ start, goal, grid });
  }

  static batchCollisions({ rects }) {
    return batchCollisionsTask({ rects });
  }

  static mapPaths({ requests, grid }) {
    return mapPathsTask({ requests, grid });
  }
}

function defaultWorkerFactory() {
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') return null;
  const source = `
    self.__omnicoreStore = {};
    self.__taskSources = {};
    const fail = (message) => ({ message });
    self.onmessage = async (event) => {
      const { id, type, name, source, task, payload, key, value } = event.data || {};
      try {
        if (type === 'sync') {
          self.__omnicoreStore[key] = value;
          self.postMessage({ type: 'sync', key });
          return;
        }
        if (type === 'register') {
          if (!name || !source) throw fail('任务注册缺少 name/source。');
          self.__taskSources[name] = source;
          return;
        }
        if (type === 'task') {
          const sourceCode = task || source || self.__taskSources[name];
          if (!sourceCode) throw fail('任务未注册：' + name);
          const fn = (0, eval)('(' + sourceCode + ')');
          if (typeof fn !== 'function') throw fail('任务源码没有生成函数。');
          const safePayload = payload && typeof payload === 'object' ? { ...payload } : { value: payload };
          const result = await fn({ ...safePayload, store: self.__omnicoreStore });
          self.postMessage({ type: 'task', id, result });
          return;
        }
        throw fail('未知消息类型。');
      } catch (error) {
        self.postMessage({ type: 'task', id, error: error && error.message ? error.message : String(error) });
      }
    };
  `;
  return new Worker(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
}

function isSerializablePayload(payload) {
  try {
    JSON.stringify(payload);
    return true;
  } catch {
    return false;
  }
}

function serializeHandler(handler) {
  const source = handler.toString();
  if (/^(async\s+)?function\b/.test(source) || /^\(?[\w\s,{}[\]=.]*\)?\s*=>/.test(source)) return source;
  return `function ${source}`;
}

function storeInt(channel, index, value) {
  if (channel.shared) Atomics.store(channel.state, index, value);
  else channel.state[index] = value;
}

function loadInt(channel, index) {
  return channel.shared ? Atomics.load(channel.state, index) : channel.state[index];
}

function addInt(channel, index, value) {
  if (channel.shared) return Atomics.add(channel.state, index, value) + value;
  channel.state[index] += value;
  return channel.state[index];
}

function astarTask({ start, goal, grid }) {
  const manhattan = (left, right) => Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
  const adjacent = (point) => [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 }
  ].filter((item) => grid[item.y]?.[item.x] === 0);
  const toPath = (node) => {
    const path = [];
    let current = node;
    while (current) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }
    return path;
  };
  const key = (point) => `${point.x},${point.y}`;
  const open = [{ ...start, g: 0, f: manhattan(start, goal), parent: null }];
  const closed = new Set();

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    if (current.x === goal.x && current.y === goal.y) return toPath(current);
    closed.add(key(current));

    for (const next of adjacent(current)) {
      if (closed.has(key(next))) continue;
      const g = current.g + 1;
      const existing = open.find((node) => node.x === next.x && node.y === next.y);
      if (!existing) {
        open.push({ ...next, g, f: g + manhattan(next, goal), parent: current });
      } else if (g < existing.g) {
        existing.g = g;
        existing.f = g + manhattan(existing, goal);
        existing.parent = current;
      }
    }
  }

  return [];
}

function batchCollisionsTask({ rects = [] }) {
  const overlaps = (left = {}, right = {}) => (left.x || 0) < (right.x || 0) + (right.width || 0)
    && (left.x || 0) + (left.width || 0) > (right.x || 0)
    && (left.y || 0) < (right.y || 0) + (right.height || 0)
    && (left.y || 0) + (left.height || 0) > (right.y || 0);
  const collisions = [];
  for (let leftIndex = 0; leftIndex < rects.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rects.length; rightIndex += 1) {
      if (overlaps(rects[leftIndex], rects[rightIndex])) {
        collisions.push({
          a: rects[leftIndex].id ?? leftIndex,
          b: rects[rightIndex].id ?? rightIndex
        });
      }
    }
  }
  return collisions;
}

function mapPathsTask({ requests = [], grid = [] }) {
  const astar = ({ start, goal, grid: localGrid }) => {
    const manhattan = (left, right) => Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
    const adjacent = (point) => [
      { x: point.x + 1, y: point.y },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x, y: point.y - 1 }
    ].filter((item) => localGrid[item.y]?.[item.x] === 0);
    const toPath = (node) => {
      const path = [];
      let current = node;
      while (current) {
        path.unshift({ x: current.x, y: current.y });
        current = current.parent;
      }
      return path;
    };
    const key = (point) => `${point.x},${point.y}`;
    const open = [{ ...start, g: 0, f: manhattan(start, goal), parent: null }];
    const closed = new Set();
    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      if (current.x === goal.x && current.y === goal.y) return toPath(current);
      closed.add(key(current));
      for (const next of adjacent(current)) {
        if (closed.has(key(next))) continue;
        const g = current.g + 1;
        const existing = open.find((node) => node.x === next.x && node.y === next.y);
        if (!existing) {
          open.push({ ...next, g, f: g + manhattan(next, goal), parent: current });
        } else if (g < existing.g) {
          existing.g = g;
          existing.f = g + manhattan(existing, goal);
          existing.parent = current;
        }
      }
    }
    return [];
  };
  return requests.map((request) => ({
    id: request.id,
    path: astar({ start: request.start, goal: request.goal, grid: request.grid || grid })
  }));
}

export default WorkerManager;
