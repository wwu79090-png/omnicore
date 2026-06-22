export class PersistentSaveSlot {
  constructor({ adapter = memoryAdapter() } = {}) {
    this.adapter = adapter;
    this.slot = null;
    this.data = {};
    this.dirty = false;
  }

  bind(slot = 'default') {
    this.slot = String(slot);
    return this;
  }

  load() {
    const raw = this.adapter.read?.(this.key());
    this.data = raw ? clone(raw) : {};
    this.dirty = false;
    return this;
  }

  get(path, fallback = undefined) {
    const value = getPath(this.data, path);
    return value === undefined ? fallback : value;
  }

  set(path, value) {
    setPath(this.data, path, clone(value));
    this.dirty = true;
    return this;
  }

  flush() {
    this.adapter.write?.(this.key(), clone(this.data));
    this.dirty = false;
    return this;
  }

  reset() {
    this.adapter.remove?.(this.key());
    this.data = {};
    this.dirty = false;
    return this;
  }

  key() {
    return `omnicore:save:${this.slot || 'default'}`;
  }
}

function memoryAdapter() {
  const backing = {};
  return {
    read: (key) => backing[key] || null,
    write: (key, value) => {
      backing[key] = value;
    },
    remove: (key) => {
      delete backing[key];
    }
  };
}

function getPath(source = {}, path = '') {
  return String(path).split('.').reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function setPath(target, path, value) {
  const parts = String(path).split('.');
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part];
  });
  cursor[parts[parts.length - 1]] = value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default PersistentSaveSlot;
