/**
 * Persistence addon for localStorage/IndexedDB-like adapters, slots, snapshots,
 * version migration, rollback, and automatic repair.
 */
export class StorageAddon {
  constructor({ adapter = null, prefix = 'omnicore' } = {}) {
    this.adapter = adapter || createLocalAdapter();
    this.prefix = prefix;
    this.snapshots = new Map();
  }

  mount(bootstrap) {
    this.bootstrap = bootstrap;
    return this;
  }

  save(slot, data) {
    this.adapter.setItem(this._key(slot), JSON.stringify(data));
    return data;
  }

  load(slot, fallback = null) {
    const value = this.adapter.getItem(this._key(slot));
    if (value == null) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  snapshot(name = 'latest') {
    const data = this.bootstrap?.store.snapshot() || {};
    this.snapshots.set(name, data);
    return data;
  }

  rollback(name = 'latest') {
    return this.snapshots.get(name) || null;
  }

  migrate(slot, targetVersion, migrations = {}) {
    const current = this.load(slot, { version: targetVersion, state: {} });
    const key = `${current.version}->${targetVersion}`;
    const backup = structuredCloneSafe(current);
    const state = migrations[key] ? migrations[key](current.state || {}) : current.state || {};
    const next = { version: targetVersion, state, backup };
    this.save(slot, next);
    return next;
  }

  repair(slot, repairer) {
    const data = this.load(slot, {});
    const repaired = repairer(data);
    this.save(slot, repaired);
    return repaired;
  }

  _key(slot) {
    return `${this.prefix}:${slot}`;
  }
}

function createLocalAdapter() {
  const memory = new Map();
  return {
    setItem(key, value) {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        memory.set(key, value);
      }
    },
    getItem(key) {
      try {
        return globalThis.localStorage?.getItem(key) ?? memory.get(key) ?? null;
      } catch {
        return memory.get(key) ?? null;
      }
    }
  };
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export default StorageAddon;
