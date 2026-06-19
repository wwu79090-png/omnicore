import { warnMessage } from '../../core/OmniError.js';
import { DEFAULT_DEBUG, DEFAULT_ENGINE_VERSION } from '../../config/defaults.js';

/**
 * Reactive dependency-free state store with version migration and emergency
 * repair hooks.
 *
 * @example
 * const store = new Store({ initialState: { hp: 10 }, version: '1.0.0' });
 * store.watch('hp', (hp) => console.log(hp));
 * store.set('hp', 9);
 */
export class Store {
  constructor({
    initialState = {},
    version = DEFAULT_ENGINE_VERSION,
    migrations = {},
    emergencyPatch = {},
    debug = DEFAULT_DEBUG
  } = {}) {
    this.state = { ...initialState };
    this.version = version;
    this.migrations = migrations;
    this.emergencyPatch = emergencyPatch;
    this.debug = debug;
    this.watchers = new Map();
    this.initialTypes = Object.fromEntries(Object.entries(initialState).map(([key, value]) => [key, typeOf(value)]));
  }

  set(key, value) {
    this._warnTypeDrift(key, value);
    const next = this._repair(key, value);
    this.state[key] = next;
    this._notify(key, next);
    return next;
  }

  get(key, fallback = undefined) {
    return Object.prototype.hasOwnProperty.call(this.state, key) ? this.state[key] : fallback;
  }

  watch(key, handler) {
    if (!this.watchers.has(key)) this.watchers.set(key, new Set());
    this.watchers.get(key).add(handler);
    return () => this.watchers.get(key)?.delete(handler);
  }

  snapshot() {
    return {
      version: this.version,
      state: structuredCloneSafe(this.state),
      createdAt: new Date().toISOString()
    };
  }

  migrate(payload = {}) {
    const from = payload.version || '0.0.0';
    const to = this.version;
    const backup = structuredCloneSafe(payload);
    const previous = structuredCloneSafe(this.state);
    if (from === to) {
      this.state = { ...(payload.state || {}) };
      this._notifyChanged(previous, this.state);
      return { version: to, state: this.state, backup, migrated: false };
    }
    const key = `${from}->${to}`;
    const sourceState = structuredCloneSafe(payload.state || {});
    const migratedState = this.migrations[key] ? this.migrations[key](sourceState, { from, to, store: this }) : sourceState;
    this.state = { ...migratedState };
    this._notifyChanged(previous, this.state);
    return {
      version: to,
      state: structuredCloneSafe(this.state),
      backup,
      migrated: Boolean(this.migrations[key])
    };
  }

  _notify(key, value) {
    for (const handler of this.watchers.get(key) || []) handler(value, key);
    for (const handler of this.watchers.get('*') || []) handler(value, key);
  }

  _notifyChanged(previous, next) {
    const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
    for (const key of keys) {
      if (!Object.is(previous[key], next[key])) this._notify(key, next[key]);
    }
  }

  _warnTypeDrift(key, value) {
    if (!this.debug) return;
    const expected = this.initialTypes[key];
    const actual = typeOf(value);
    if (expected && expected !== 'null' && expected !== actual) {
      console.warn(warnMessage('Store', `状态类型不一致 "${key}"：期望 ${expected}，实际 ${actual}。`));
    }
  }

  _repair(key, value) {
    const patch = this.emergencyPatch[key];
    if (!patch) return value;
    if (typeof patch === 'function') {
      const next = patch(value);
      if (this.debug && next !== value) console.warn(warnMessage('Store', `emergencyPatch 已修复状态 "${key}"。`));
      return next;
    }
    if (typeof value !== 'number' || value < patch.min || value > patch.max) {
      if (this.debug) console.warn(warnMessage('Store', `emergencyPatch 已修复状态 "${key}"。`));
      return patch.fallback;
    }
    return value;
  }
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export default Store;
