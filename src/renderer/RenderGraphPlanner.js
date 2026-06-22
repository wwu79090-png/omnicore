import { createOmniError } from '../core/OmniError.js';

export class RenderGraphPlanner {
  constructor() {
    this.passes = new Map();
  }

  addPass(name, { reads = [], writes = [], sideEffect = false } = {}) {
    const key = String(name);
    this.passes.set(key, {
      name: key,
      reads: normalizeArray(reads).map(String),
      writes: normalizeArray(writes).map(String),
      sideEffect: Boolean(sideEffect)
    });
    return this;
  }

  compile({ outputs = [] } = {}) {
    const required = this._requiredPasses(outputs);
    const order = [];
    const visiting = new Set();
    const visited = new Set();

    for (const name of required) this._visit(name, required, visiting, visited, order);

    const activeOrder = order.map((name) => this.passes.get(name));
    const activeNames = new Set(activeOrder.map((pass) => pass.name));
    return {
      order: activeOrder.map((pass) => clone(pass)),
      culled: [...this.passes.keys()].filter((name) => !activeNames.has(name)).sort(),
      resources: this._resources(activeOrder)
    };
  }

  _requiredPasses(outputs) {
    const producers = this._producers();
    const required = new Set();
    const stack = [
      ...normalizeArray(outputs).map(String),
      ...[...this.passes.values()].filter((pass) => pass.sideEffect).flatMap((pass) => pass.writes)
    ];

    while (stack.length > 0) {
      const resource = stack.pop();
      const pass = producers.get(resource);
      if (!pass || required.has(pass.name)) continue;
      required.add(pass.name);
      stack.push(...pass.reads);
    }
    return required;
  }

  _visit(name, required, visiting, visited, order) {
    if (visited.has(name)) return;
    if (visiting.has(name)) throw createOmniError('RenderGraphPlanner', `Render graph cycle detected at pass: ${name}`);
    const pass = this.passes.get(name);
    if (!pass) throw createOmniError('RenderGraphPlanner', `Render pass is not registered: ${name}`);
    visiting.add(name);
    const producers = this._producers();
    for (const resource of pass.reads) {
      const producer = producers.get(resource);
      if (producer && required.has(producer.name)) this._visit(producer.name, required, visiting, visited, order);
    }
    visiting.delete(name);
    visited.add(name);
    order.push(name);
  }

  _producers() {
    const producers = new Map();
    for (const pass of this.passes.values()) {
      for (const resource of pass.writes) producers.set(resource, pass);
    }
    return producers;
  }

  _resources(activePasses) {
    const resources = {};
    for (const pass of activePasses) {
      for (const resource of pass.writes) {
        resources[resource] = resources[resource] || { producer: pass.name, consumers: [] };
        resources[resource].producer = pass.name;
      }
      for (const resource of pass.reads) {
        resources[resource] = resources[resource] || { producer: null, consumers: [] };
        resources[resource].consumers.push(pass.name);
      }
    }
    return resources;
  }
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default RenderGraphPlanner;
