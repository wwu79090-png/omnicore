export class RuntimeConfigFlags {
  constructor({ defaults = [], flags = {} } = {}) {
    this.flags = clone(flags || {});
    this.active = new Set(defaults.map(String));
  }

  set(flag) {
    this.active.add(String(flag));
    return this;
  }

  clear(flag) {
    this.active.delete(String(flag));
    return this;
  }

  toggle(flag) {
    const key = String(flag);
    if (this.active.has(key)) this.active.delete(key);
    else this.active.add(key);
    return this;
  }

  enabled() {
    return [...this.active].sort();
  }

  resolve() {
    const modules = {};
    const features = {};
    for (const [flag, config] of Object.entries(this.flags)) {
      features[config.feature || flag] = this.active.has(flag);
      if (this.active.has(flag)) {
        const moduleName = config.module || 'core';
        if (!modules[moduleName]) modules[moduleName] = [];
        modules[moduleName].push(flag);
      }
    }
    return {
      modules: Object.fromEntries(
        Object.entries(modules).map(([moduleName, flags]) => [moduleName, flags.sort()])
      ),
      features: Object.fromEntries(Object.entries(features).sort(([left], [right]) => left.localeCompare(right)))
    };
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default RuntimeConfigFlags;
