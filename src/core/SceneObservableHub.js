import { createOmniError } from './OmniError.js';

export class SceneObservableHub {
  constructor(observables = []) {
    this.observables = new Map();
    this.nextId = 1;
    for (const name of observables) this.ensure(name);
  }

  ensure(name) {
    const key = String(name);
    if (!this.observables.has(key)) this.observables.set(key, []);
    return this;
  }

  add(name, callback, { mask = '*', priority = 0, once = false } = {}) {
    if (typeof callback !== 'function') {
      throw createOmniError('SceneObservableHub', `Observer callback is required for observable: ${name}`);
    }
    this.ensure(name);
    const observer = {
      id: this.nextId,
      callback,
      mask,
      priority: Number(priority || 0),
      once: Boolean(once)
    };
    this.nextId += 1;
    this.observables.get(String(name)).push(observer);
    this._sort(name);
    return observer;
  }

  remove(name, observer) {
    const key = String(name);
    const id = typeof observer === 'object' ? observer.id : observer;
    this.observables.set(key, (this.observables.get(key) || []).filter((entry) => entry.id !== id));
    return this;
  }

  removeCallback(name, callback) {
    const key = String(name);
    this.observables.set(key, (this.observables.get(key) || []).filter((entry) => entry.callback !== callback));
    return this;
  }

  notify(name, payload = {}, { mask = null } = {}) {
    const key = String(name);
    const activeMask = mask ?? payload.mask ?? '*';
    const observers = [...(this.observables.get(key) || [])];
    for (const observer of observers) {
      if (!matchesMask(observer.mask, activeMask)) continue;
      observer.callback(payload);
      if (observer.once) this.remove(key, observer);
    }
    return this;
  }

  renderFrame(payload = {}) {
    this.notify('beforeRender', payload);
    this.notify('afterRender', payload);
    return this;
  }

  snapshot() {
    return Object.fromEntries([...this.observables.keys()].sort().map((name) => [
      name,
      (this.observables.get(name) || []).map((observer) => ({
        id: observer.id,
        mask: observer.mask,
        priority: observer.priority,
        once: observer.once
      }))
    ]));
  }

  _sort(name) {
    this.observables.get(String(name)).sort((a, b) => b.priority - a.priority || a.id - b.id);
  }
}

function matchesMask(observerMask, activeMask) {
  return observerMask === '*' || activeMask === '*' || observerMask === activeMask;
}

export default SceneObservableHub;
