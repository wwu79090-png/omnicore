import { createOmniError } from './OmniError.js';

export class Hook {
  constructor() {
    this.listeners = new Map();
  }

  on(name, handler) {
    if (!name || typeof handler !== 'function') {
      throw createOmniError('Hook', 'Hook.on(name, handler) requires an event name and function handler.');
    }
    const bucket = this.listeners.get(name) || new Set();
    bucket.add(handler);
    this.listeners.set(name, bucket);
    return () => this.off(name, handler);
  }

  once(name, handler) {
    const off = this.on(name, (...args) => {
      off();
      return handler(...args);
    });
    return off;
  }

  off(name, handler) {
    const bucket = this.listeners.get(name);
    if (!bucket) return false;
    const removed = bucket.delete(handler);
    if (bucket.size === 0) this.listeners.delete(name);
    return removed;
  }

  emit(name, payload, context = {}) {
    const bucket = this.listeners.get(name);
    if (!bucket) return [];
    const results = [];
    for (const handler of [...bucket]) results.push(handler(payload, context));
    return results;
  }

  async emitAsync(name, payload, context = {}) {
    return Promise.all(this.emit(name, payload, context));
  }

  clear(name = null) {
    if (name) this.listeners.delete(name);
    else this.listeners.clear();
  }
}

export const GlobalHook = new Hook();

export default Hook;
