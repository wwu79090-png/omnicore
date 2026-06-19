/**
 * Dependency-free event bus for the lean OmniCore microkernel.
 *
 * @example
 * const bus = new EventBus();
 * const off = bus.on('ready', (payload) => console.log(payload));
 * bus.emit('ready', { ok: true });
 * off();
 */
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
    return () => this.off(type, handler);
  }

  once(type, handler) {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type, payload = undefined) {
    for (const handler of this.listeners.get(type) || []) handler(payload);
  }

  clear() {
    this.listeners.clear();
  }
}

export default EventBus;
