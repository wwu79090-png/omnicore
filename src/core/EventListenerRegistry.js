const LEAK_WARNING = '[OmniCore] 实体销毁未解绑事件，潜在泄漏风险';

function resolveEntity(options, handler) {
  return options?.entity
    || options?.owner
    || options?.target
    || handler?.entity
    || handler?.owner
    || null;
}

/**
 * Tracks EventBus listeners owned by entity instances and clears them on destroy.
 */
export class EventListenerRegistry {
  constructor({ warn = console.warn } = {}) {
    this.warn = warn;
    this.listenersByEntity = new WeakMap();
    this.entities = new Set();
    this.patchedBuses = new WeakMap();
    this.patchedEntities = new WeakSet();
  }

  trackEventBus(eventBus) {
    if (!eventBus || typeof eventBus.on !== 'function') return eventBus;
    if (this.patchedBuses.has(eventBus)) return eventBus;

    const originalOn = eventBus.on;
    this.patchedBuses.set(eventBus, originalOn);
    eventBus.on = (event, handler, options = {}) => {
      const unsubscribe = originalOn.call(eventBus, event, handler);
      const entity = resolveEntity(options, handler);
      if (!entity) return unsubscribe;
      this.trackEntity(entity);
      const entry = {
        eventBus,
        event,
        handler,
        active: true,
        unsubscribe: () => {
          if (!entry.active) return;
          entry.active = false;
          unsubscribe?.();
          this.unregister(entity, entry);
        }
      };
      this.register(entity, entry);
      return entry.unsubscribe;
    };
    return eventBus;
  }

  trackEntity(entity) {
    if (!entity || typeof entity !== 'object') return entity;
    this.entities.add(entity);
    if (this.patchedEntities.has(entity)) return entity;
    const originalDestroy = typeof entity.destroy === 'function' ? entity.destroy : null;
    const registry = this;
    entity.destroy = function destroyWithEventCleanup(...args) {
      registry.cleanupEntity(this);
      return originalDestroy?.apply(this, args);
    };
    this.patchedEntities.add(entity);
    return entity;
  }

  register(entity, entry) {
    if (!entity || !entry) return null;
    if (!this.listenersByEntity.has(entity)) this.listenersByEntity.set(entity, new Set());
    this.listenersByEntity.get(entity).add(entry);
    this.entities.add(entity);
    return entry;
  }

  unregister(entity, entry) {
    const entries = this.listenersByEntity.get(entity);
    if (!entries) return false;
    const removed = entries.delete(entry);
    if (entries.size === 0) {
      this.listenersByEntity.delete(entity);
      this.entities.delete(entity);
    }
    return removed;
  }

  count(entity) {
    return this.listenersByEntity.get(entity)?.size || 0;
  }

  cleanupEntity(entity, { forceLeakWarning = false } = {}) {
    const entries = this.listenersByEntity.get(entity);
    if (!entries?.size) {
      if (forceLeakWarning) this.warn?.(LEAK_WARNING);
      return 0;
    }

    let cleaned = 0;
    for (const entry of [...entries]) {
      try {
        entry.unsubscribe?.();
        cleaned += 1;
      } catch {
        entry.eventBus?.off?.(entry.event, entry.handler);
        entries.delete(entry);
      }
    }

    const leaked = entries.size > 0 || forceLeakWarning;
    if (leaked) {
      this.warn?.(LEAK_WARNING);
      entries.clear();
    }
    this.listenersByEntity.delete(entity);
    this.entities.delete(entity);
    return cleaned;
  }

  cleanupAll() {
    let total = 0;
    for (const entity of [...this.entities]) total += this.cleanupEntity(entity);
    return total;
  }
}

export const DEFAULT_EVENT_LISTENER_REGISTRY = new EventListenerRegistry();

export function attachEntityEventTracking(entity, eventBus, registry = DEFAULT_EVENT_LISTENER_REGISTRY) {
  registry.trackEntity(entity);
  return registry.trackEventBus(eventBus);
}

export function getEntityListenerCount(entity, registry = DEFAULT_EVENT_LISTENER_REGISTRY) {
  return registry.count(entity);
}

export function cleanupEntityListeners(entity, registry = DEFAULT_EVENT_LISTENER_REGISTRY) {
  return registry.cleanupEntity(entity);
}

export default DEFAULT_EVENT_LISTENER_REGISTRY;
