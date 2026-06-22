import { createOmniError } from '../core/OmniError.js';

export class ObjectTimelineRuntime {
  constructor({ objects = {} } = {}) {
    this.objects = { ...objects };
    this.instances = new Map();
    this.nextId = 1;
    this.log = [];
    this.currentEvent = null;
  }

  spawn(type, state = {}) {
    const definition = this._definition(type);
    const instance = {
      id: `${type}:${this.nextId}`,
      type,
      state: { ...state },
      alarms: {},
      frame: 0,
      alive: true
    };
    this.nextId += 1;
    this.instances.set(instance.id, instance);
    this._runEvent(instance, 'create', definition);
    return instance;
  }

  step() {
    for (const instance of this._aliveInstances()) {
      const definition = this._definition(instance.type);
      this._runEvent(instance, 'beginStep', definition);
      this._tickAlarms(instance, definition);
      this._runEvent(instance, 'step', definition);
      instance.frame += 1;
      this._runTimeline(instance, definition);
      this._runEvent(instance, 'endStep', definition);
    }
    return this;
  }

  draw() {
    for (const instance of this._aliveInstances()) {
      this._runEvent(instance, 'draw', this._definition(instance.type));
    }
    return this;
  }

  snapshot() {
    return this._aliveInstances().map((instance) => ({
      id: instance.id,
      type: instance.type,
      frame: instance.frame,
      state: clone(instance.state),
      alarms: clone(instance.alarms)
    }));
  }

  _tickAlarms(instance, definition) {
    for (const index of Object.keys(instance.alarms)) {
      instance.alarms[index] -= 1;
      if (instance.alarms[index] <= 0) {
        delete instance.alarms[index];
        this._runEvent(instance, `alarm${index}`, definition);
      }
    }
  }

  _runTimeline(instance, definition) {
    const action = definition.timeline?.[instance.frame];
    if (!action) return;
    this._runCallback(instance, `timeline${instance.frame}`, action);
  }

  _runEvent(instance, eventName, definition) {
    const handler = definition.events?.[eventName];
    if (handler) this._runCallback(instance, eventName, handler);
  }

  _runCallback(instance, eventName, handler) {
    const previous = this.currentEvent;
    this.currentEvent = eventName;
    handler(this._context(instance));
    this.currentEvent = previous;
  }

  _context(instance) {
    return {
      runtime: this,
      instance,
      id: instance.id,
      type: instance.type,
      state: instance.state,
      frame: instance.frame,
      setAlarm: (index, frames) => {
        const key = String(index);
        if (frames == null || frames < 0) delete instance.alarms[key];
        else instance.alarms[key] = Math.max(0, Math.floor(Number(frames)));
      },
      log: (message, data = null) => {
        this.log.push({
          instanceId: instance.id,
          type: instance.type,
          event: this.currentEvent,
          message,
          data: clone(data)
        });
      },
      destroy: () => {
        instance.alive = false;
      }
    };
  }

  _aliveInstances() {
    return [...this.instances.values()].filter((instance) => instance.alive);
  }

  _definition(type) {
    const definition = this.objects[type];
    if (!definition) throw createOmniError('ObjectTimelineRuntime', `Object definition is not registered: ${type}`);
    return definition;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default ObjectTimelineRuntime;
