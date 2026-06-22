import { createOmniError } from './OmniError.js';

export class ServerHandleRegistry {
  constructor({ namespace = 'server' } = {}) {
    this.namespace = String(namespace || 'server');
    this.nextId = 1;
    this.handles = new Map();
    this.commands = [];
  }

  create(type, payload = {}) {
    const rid = `${this.namespace}:${this.nextId}`;
    this.nextId += 1;
    const entry = { rid, type: String(type), payload: clone(payload) };
    this.handles.set(rid, entry);
    this.commands.push({ op: 'create', rid, type: entry.type, payload: clone(payload) });
    return rid;
  }

  set(rid, patch = {}) {
    const entry = this._handle(rid);
    entry.payload = { ...entry.payload, ...clone(patch) };
    this.commands.push({ op: 'set', rid: entry.rid, patch: clone(patch) });
    return this;
  }

  free(rid) {
    const entry = this._handle(rid);
    this.handles.delete(entry.rid);
    this.commands.push({ op: 'free', rid: entry.rid });
    return this;
  }

  flush() {
    const commands = this.commands.map(clone);
    this.commands = [];
    return commands;
  }

  snapshot() {
    return {
      namespace: this.namespace,
      handles: [...this.handles.values()].sort((a, b) => a.rid.localeCompare(b.rid)).map(clone)
    };
  }

  _handle(rid) {
    const entry = this.handles.get(String(rid));
    if (!entry) throw createOmniError('ServerHandleRegistry', `Handle is not registered: ${rid}`);
    return entry;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default ServerHandleRegistry;
