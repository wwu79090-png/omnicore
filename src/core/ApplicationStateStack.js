import { createOmniError } from './OmniError.js';

export class ApplicationStateStack {
  constructor() {
    this.states = new Map();
  }

  attach(id, state = {}, { enabled = true } = {}) {
    const key = String(id);
    const entry = {
      id: key,
      state,
      initialized: true,
      enabled: Boolean(enabled)
    };
    this.states.set(key, entry);
    state.initialize?.({ id: key, manager: this });
    if (entry.enabled) state.onEnable?.({ id: key, manager: this });
    return this;
  }

  detach(id) {
    const entry = this._entry(id);
    if (entry.enabled) entry.state.onDisable?.({ id: entry.id, manager: this });
    entry.state.cleanup?.({ id: entry.id, manager: this });
    this.states.delete(entry.id);
    return this;
  }

  setEnabled(id, enabled) {
    const entry = this._entry(id);
    const next = Boolean(enabled);
    if (entry.enabled === next) return this;
    entry.enabled = next;
    if (next) entry.state.onEnable?.({ id: entry.id, manager: this });
    else entry.state.onDisable?.({ id: entry.id, manager: this });
    return this;
  }

  update(dt = 0) {
    for (const entry of this.states.values()) {
      if (entry.enabled) entry.state.update?.({ id: entry.id, manager: this, dt });
    }
    return this;
  }

  render(context = {}) {
    for (const entry of this.states.values()) {
      if (entry.enabled) entry.state.render?.({ id: entry.id, manager: this, context });
    }
    return this;
  }

  snapshot() {
    return [...this.states.values()].map((entry) => ({
      id: entry.id,
      enabled: entry.enabled,
      initialized: entry.initialized
    }));
  }

  _entry(id) {
    const entry = this.states.get(String(id));
    if (!entry) throw createOmniError('ApplicationStateStack', `Application state is not attached: ${id}`);
    return entry;
  }
}

export default ApplicationStateStack;
