export class SceneTransitionStack {
  constructor({ hooks = {} } = {}) {
    this.hooks = hooks;
    this.stack = [];
  }

  push(name, params = {}) {
    const current = this.current();
    if (current) this.hooks.pause?.(current);
    const entry = createEntry(name, params);
    this.stack.push(entry);
    this.hooks.enter?.(entry);
    return entry;
  }

  pop() {
    const entry = this.stack.pop();
    if (!entry) return null;
    this.hooks.exit?.(entry);
    const current = this.current();
    if (current) this.hooks.resume?.(current);
    return entry;
  }

  replace(name, params = {}) {
    const previous = this.stack.pop();
    if (previous) this.hooks.exit?.(previous);
    const entry = createEntry(name, params);
    this.stack.push(entry);
    this.hooks.enter?.(entry);
    return entry;
  }

  current() {
    return this.stack[this.stack.length - 1] || null;
  }

  entries() {
    return this.stack.map((entry) => ({ ...entry, params: clone(entry.params) }));
  }
}

function createEntry(name, params = {}) {
  return {
    name: String(name),
    params: clone(params || {})
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default SceneTransitionStack;
