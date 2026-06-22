export class ObjectEventMap {
  constructor(events = {}) {
    this.events = new Map(Object.entries(events).map(([name, handlers]) => [
      name,
      Array.isArray(handlers) ? handlers : [handlers]
    ]));
  }

  on(name, handler) {
    const handlers = this.events.get(name) || [];
    handlers.push(handler);
    this.events.set(name, handlers);
    return () => this.off(name, handler);
  }

  off(name, handler) {
    const handlers = this.events.get(name) || [];
    this.events.set(name, handlers.filter((item) => item !== handler));
  }

  async dispatch(name, entity, payload = null, context = {}) {
    const handlers = this.events.get(name) || [];
    for (const handler of handlers) await handler(entity, payload, context);
    return { event: name, handlers: handlers.length };
  }
}

export default ObjectEventMap;
