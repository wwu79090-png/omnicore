import { createOmniError } from '../core/OmniError.js';

/**
 * Tracks render-facing property changes and syncs only dirty records.
 */
export class DirtyFlagTracker {
  constructor({ sync = null } = {}) {
    this.sync = sync;
    this.records = new Map();
    this.entityToId = new WeakMap();
  }

  track(entity, id = entity?.id) {
    if (!entity || typeof entity !== 'object') {
      throw createOmniError('Performance', 'DirtyFlagTracker.track(entity) requires an object.');
    }
    const resolvedId = id || `entity-${this.records.size + 1}`;
    let record = this.records.get(resolvedId);
    if (!record) {
      record = {
        id: resolvedId,
        entity,
        dirty: new Set(),
        lastSyncedAt: 0
      };
      this.records.set(resolvedId, record);
    } else {
      record.entity = entity;
    }
    this.entityToId.set(entity, resolvedId);
    return record;
  }

  mark(entityOrId, property) {
    const record = this._recordFor(entityOrId);
    if (!record || !property) return false;
    record.dirty.add(property);
    return true;
  }

  set(entityOrId, property, value) {
    const record = this._recordFor(entityOrId) || this.track(entityOrId);
    const previous = record.entity[property];
    record.entity[property] = value;
    if (!Object.is(previous, value)) record.dirty.add(property);
    return value;
  }

  collectDirty() {
    return [...this.records.values()].filter((record) => record.dirty.size > 0);
  }

  clear(entityOrId = null) {
    if (entityOrId == null) {
      for (const record of this.records.values()) record.dirty.clear();
      return this;
    }
    this._recordFor(entityOrId)?.dirty.clear();
    return this;
  }

  syncOnlyDirty({ now = Date.now() } = {}) {
    const dirtyRecords = this.collectDirty();
    let syncedProperties = 0;
    for (const record of dirtyRecords) {
      const properties = [...record.dirty];
      syncedProperties += properties.length;
      this.sync?.(record.entity, properties, record);
      record.lastSyncedAt = now;
      record.dirty.clear();
    }
    return {
      format: 'OmniCore.DirtyFlagSync',
      dirtyCount: dirtyRecords.length,
      syncedProperties
    };
  }

  _recordFor(entityOrId) {
    if (typeof entityOrId === 'string') return this.records.get(entityOrId) || null;
    const id = this.entityToId.get(entityOrId);
    return id ? this.records.get(id) || null : null;
  }
}

export default DirtyFlagTracker;
