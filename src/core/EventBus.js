import { createOmniError } from './OmniError.js';

/**
 * Tiny event emitter used by scenes, UI elements, loader, and debug tooling.
 *
 * @example
 * const bus = new EventBus();
 * const off = bus.on('ready', (payload) => console.log(payload));
 * bus.emit('ready', { scene: 'boot' });
 * off();
 */
export class EventBus {
  constructor({
    frameEventLimit = Number.POSITIVE_INFINITY,
    overflowThreshold = 100,
    microbatchSize = 10,
    maxRecursionDepth = 50,
    recursionGuard = true
  } = {}) {
    this.listeners = new Map();
    this.frameEventLimit = frameEventLimit;
    this.frameEventCount = 0;
    this.microbatchQueue = [];
    this.overflowThreshold = overflowThreshold;
    this.microbatchSize = microbatchSize;
    this.eventQueue = [];
    this.maxRecursionDepth = maxRecursionDepth;
    this.recursionGuard = recursionGuard;
    this.recursionStack = [];
    this.recursionDiagnostics = {
      lastCycle: [],
      lastDepth: 0,
      lastError: null
    };
  }

  /**
   * @param {string} event Event name.
   * @param {Function} handler Event handler.
   * @returns {Function} Unsubscribe callback.
   */
  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * @param {string} event Event name.
   * @param {Function} handler Event handler invoked once.
   * @returns {Function} Unsubscribe callback.
   */
  once(event, handler) {
    const off = this.on(event, (...args) => {
      off();
      handler(...args);
    });
    return off;
  }

  /**
   * @param {string} event Event name.
   * @param {Function} handler Event handler to remove.
   * @returns {void}
   */
  off(event, handler) {
    this.listeners.get(event)?.delete(handler);
  }

  /**
   * @param {string} event Event name.
   * @param {*} payload Event payload.
   * @returns {void}
   */
  emit(event, payload) {
    if (this.frameEventCount >= this.frameEventLimit) {
      this.microbatchQueue.push({ event, payload });
      return;
    }
    this.frameEventCount += 1;
    this._dispatch(event, payload);
  }

  /**
   * @param {string} event Event name.
   * @param {*} payload Event payload.
   * @returns {number} Number of queued events.
   */
  queueEvent(event, payload, { timestamp = Date.now() } = {}) {
    this.eventQueue.push({ event, payload, timestamp });
    return this.eventQueue.length;
  }

  /**
   * @returns {number} Number of queued events processed this frame.
   */
  processEventFrame() {
    this.eventQueue.sort((left, right) => left.timestamp - right.timestamp);
    const limit = this.eventQueue.length > this.overflowThreshold
      ? this.microbatchSize
      : this.eventQueue.length;
    const batch = this.eventQueue.splice(0, limit);
    for (const item of batch) {
      this._dispatch(item.event, item.payload);
    }
    return batch.length;
  }

  /**
   * @returns {number} Number of timestamped events waiting for frame processing.
   */
  pendingEventCount() {
    return this.eventQueue.length;
  }

  /**
   * @param {number} limit Maximum queued events to flush.
   * @returns {number} Number of queued events flushed.
   */
  flushMicrobatches(limit = Number.POSITIVE_INFINITY) {
    this.frameEventCount = 0;
    let flushed = 0;
    while (this.microbatchQueue.length && flushed < limit) {
      const item = this.microbatchQueue.shift();
      this.emit(item.event, item.payload);
      flushed += 1;
    }
    this.frameEventCount = 0;
    return flushed;
  }

  /**
   * @returns {number} Number of events deferred into the microbatch queue.
   */
  pendingMicrobatchCount() {
    return this.microbatchQueue.length;
  }

  /**
   * @returns {void}
   */
  resetFrameBudget() {
    this.frameEventCount = 0;
  }

  /**
   * @returns {object} Last recursion or cycle diagnostic.
   */
  getRecursionDiagnostics() {
    return {
      ...this.recursionDiagnostics,
      lastCycle: [...this.recursionDiagnostics.lastCycle]
    };
  }

  /**
   * @returns {void}
   */
  clear() {
    this.listeners.clear();
    this.microbatchQueue.length = 0;
    this.eventQueue.length = 0;
    this.frameEventCount = 0;
    this.recursionStack.length = 0;
    this.recursionDiagnostics = {
      lastCycle: [],
      lastDepth: 0,
      lastError: null
    };
  }

  _dispatch(event, payload) {
    this._assertNoRecursion(event);
    this.recursionStack.push(event);
    try {
      for (const handler of this.listeners.get(event) || []) {
        handler(payload);
      }
    } finally {
      this.recursionStack.pop();
    }
  }

  _assertNoRecursion(event) {
    if (!this.recursionGuard) return;
    const cycleStart = this.recursionStack.indexOf(event);
    if (cycleStart >= 0) {
      const cycle = [...this.recursionStack.slice(cycleStart), event];
      throw this._createRecursionError('event-loop', cycle);
    }

    if (this.recursionStack.length + 1 > this.maxRecursionDepth) {
      throw this._createRecursionError('recursion-depth', [...this.recursionStack, event]);
    }
  }

  _createRecursionError(type, path) {
    const label = path.join(' -> ');
    const message = type === 'event-loop'
      ? `Event Loop Detected: ${label}`
      : `Event Recursion Depth Exceeded: ${label}`;
    const details = {
      type,
      path,
      depth: path.length,
      maxDepth: this.maxRecursionDepth
    };
    const error = createOmniError('EventBus', message, {
      code: 'OMNICORE_EVENT_RECURSION',
      details
    });
    error.name = 'OmniCoreEventRecursionError';
    this.recursionDiagnostics = {
      lastCycle: path,
      lastDepth: path.length,
      lastError: {
        name: error.name,
        message,
        details
      }
    };
    return error;
  }
}

export default EventBus;
