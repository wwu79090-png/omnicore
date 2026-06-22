export class DebugProbe {
  constructor({ clock = () => Date.now(), maxEvents = 500 } = {}) {
    this.clock = clock;
    this.maxEvents = maxEvents;
    this.events = [];
    this.entities = [];
  }

  mark(name, data = {}) {
    this.events.push({
      name: String(name),
      at: this.clock(),
      data: clone(data || {})
    });
    if (this.events.length > this.maxEvents) this.events.shift();
    return this;
  }

  measure(name, fn) {
    const start = this.clock();
    const result = fn();
    const end = this.clock();
    this.events.push({
      name: String(name),
      at: end,
      durationMs: Math.max(0, end - start),
      data: {}
    });
    return result;
  }

  captureEntity(entity = {}) {
    this.entities.push({
      id: entity.id || entity.name || `entity-${this.entities.length + 1}`,
      type: entity.type || entity.constructor?.name || 'Entity',
      x: Number(entity.x || 0),
      y: Number(entity.y || 0),
      componentCount: collectComponents(entity).length
    });
    return this;
  }

  snapshot() {
    return {
      schema: 'omnicore.debug-probe.v1',
      eventCount: this.events.length,
      entityCount: this.entities.length,
      events: clone(this.events),
      entities: clone(this.entities)
    };
  }
}

function collectComponents(entity = {}) {
  if (Array.isArray(entity.components)) return entity.components;
  if (entity.components instanceof Map) return [...entity.components.values()];
  return [];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default DebugProbe;
