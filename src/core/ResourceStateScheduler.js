import { createOmniError } from './OmniError.js';

export class ResourceStateScheduler {
  constructor() {
    this.resources = {};
    this.states = {};
    this.nextStates = {};
    this.systems = new Map();
    this.enterHooks = new Map();
    this.exitHooks = new Map();
  }

  insertResource(key, value) {
    this.resources[String(key)] = value;
    return this;
  }

  getResource(key) {
    return this.resources[String(key)];
  }

  addState(name, initial) {
    this.states[String(name)] = initial;
    return this;
  }

  setNextState(name, value) {
    const key = String(name);
    if (!(key in this.states)) throw createOmniError('ResourceStateScheduler', `State is not registered: ${key}`);
    this.nextStates[key] = value;
    return this;
  }

  onEnter(name, value, hook) {
    this._addHook(this.enterHooks, name, value, hook);
    return this;
  }

  onExit(name, value, hook) {
    this._addHook(this.exitHooks, name, value, hook);
    return this;
  }

  addSystem(schedule, system, { label = null, state = null, runIf = null } = {}) {
    const key = String(schedule);
    if (typeof system !== 'function') {
      throw createOmniError('ResourceStateScheduler', `System must be a function for schedule: ${key}`);
    }
    if (!this.systems.has(key)) this.systems.set(key, []);
    this.systems.get(key).push({
      label: label || `${key}:${this.systems.get(key).length + 1}`,
      system,
      state,
      runIf
    });
    return this;
  }

  update(schedule = 'Update') {
    const key = String(schedule);
    const transitions = this._flushTransitions();
    const report = { schedule: key, ran: [], skipped: [], transitions };
    for (const entry of this.systems.get(key) || []) {
      if (!this._matchesSystem(entry)) {
        report.skipped.push(entry.label);
        continue;
      }
      entry.system(this._context({ schedule: key }));
      report.ran.push(entry.label);
    }
    return report;
  }

  snapshot() {
    return {
      states: { ...this.states },
      resources: Object.keys(this.resources).sort(),
      systems: Object.fromEntries([...this.systems.entries()].map(([schedule, systems]) => [
        schedule,
        systems.map((entry) => entry.label)
      ]))
    };
  }

  _flushTransitions() {
    const transitions = [];
    for (const [name, to] of Object.entries(this.nextStates)) {
      const from = this.states[name];
      delete this.nextStates[name];
      if (from === to) continue;
      const transition = { name, from, to };
      this._runHooks(this.exitHooks, name, from, transition);
      this.states[name] = to;
      this._runHooks(this.enterHooks, name, to, transition);
      transitions.push(transition);
    }
    return transitions;
  }

  _matchesSystem(entry) {
    if (entry.state) {
      for (const [name, value] of Object.entries(entry.state)) {
        if (this.states[name] !== value) return false;
      }
    }
    return entry.runIf ? Boolean(entry.runIf(this._context())) : true;
  }

  _addHook(map, name, value, hook) {
    if (typeof hook !== 'function') throw createOmniError('ResourceStateScheduler', 'State hook must be a function');
    const key = hookKey(name, value);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(hook);
  }

  _runHooks(map, name, value, transition) {
    for (const hook of map.get(hookKey(name, value)) || []) {
      hook(this._context({ transition }));
    }
  }

  _context(extra = {}) {
    return {
      scheduler: this,
      resources: this.resources,
      states: { ...this.states },
      ...extra
    };
  }
}

function hookKey(name, value) {
  return `${String(name)}:${String(value)}`;
}

export default ResourceStateScheduler;
