import { createOmniError } from './OmniError.js';

const DEFAULT_CELL_SIZE = 32;

/**
 * Uniform-grid spatial index for 2D entities.
 *
 * Entities are assigned to one 32x32 cell by their `x` and `y` position. When
 * possible, the index installs lightweight setters so moving an indexed entity
 * updates cell membership immediately.
 *
 * @example
 * const enemy = OmniCore.Query.add({ x: 64, y: 32, kind: 'enemy' });
 * const nearby = OmniCore.Query.inRadius(player.x, player.y, 160, (item) => item.kind === 'enemy');
 */
export class EntitySpatialIndex {
  constructor({ cellSize = DEFAULT_CELL_SIZE } = {}) {
    this.cellSize = Math.max(1, Number(cellSize) || DEFAULT_CELL_SIZE);
    this.cells = new Map();
    this.records = new Map();
    this.lastQueryStats = {
      entities: 0,
      cells: 0,
      candidates: 0,
      hits: 0,
      estimatedSpeedup: 0
    };
    this.stats = {
      adds: 0,
      removes: 0,
      updates: 0,
      incrementalUpdates: 0,
      rebuilds: 0
    };
  }

  add(entity) {
    if (!entity || typeof entity !== 'object') {
      throw createOmniError('Query', 'EntitySpatialIndex.add(entity) requires an object entity.');
    }
    if (this.records.has(entity)) {
      this.update(entity);
      return entity;
    }

    const record = {
      entity,
      cellX: null,
      cellY: null,
      descriptors: new Map()
    };
    this.records.set(entity, record);
    this._installPropertyHooks(entity, record);
    this._place(entity, record);
    this.stats.adds += 1;
    return entity;
  }

  remove(entity) {
    const record = this.records.get(entity);
    if (!record) return false;
    this._removeFromCell(entity, record.cellX, record.cellY);
    this._restorePropertyHooks(entity, record);
    this.records.delete(entity);
    this.stats.removes += 1;
    return true;
  }

  clear() {
    for (const entity of [...this.records.keys()]) this.remove(entity);
    this.cells.clear();
    this.lastQueryStats = {
      entities: 0,
      cells: 0,
      candidates: 0,
      hits: 0,
      estimatedSpeedup: 0
    };
    this.stats = {
      adds: 0,
      removes: 0,
      updates: 0,
      incrementalUpdates: 0,
      rebuilds: this.stats.rebuilds + 1
    };
  }

  update(entity) {
    const record = this.records.get(entity);
    if (!record) return this.add(entity);
    this.stats.updates += 1;
    this._place(entity, record);
    return entity;
  }

  inRadius(x, y, radius, filter = null) {
    const centerX = Number(x) || 0;
    const centerY = Number(y) || 0;
    const range = Math.max(0, Number(radius) || 0);
    const minCellX = Math.floor((centerX - range) / this.cellSize);
    const maxCellX = Math.floor((centerX + range) / this.cellSize);
    const minCellY = Math.floor((centerY - range) / this.cellSize);
    const maxCellY = Math.floor((centerY + range) / this.cellSize);
    const radiusSq = range * range;
    const hits = [];
    let visitedCells = 0;
    let candidates = 0;

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        visitedCells += 1;
        const bucket = this.cells.get(cellX)?.get(cellY);
        if (!bucket) continue;
        for (const entity of bucket) {
          candidates += 1;
          const dx = (entity.x || 0) - centerX;
          const dy = (entity.y || 0) - centerY;
          if (dx * dx + dy * dy > radiusSq) continue;
          if (filter && !filter(entity)) continue;
          hits.push(entity);
        }
      }
    }

    this.lastQueryStats.entities = this.records.size;
    this.lastQueryStats.cells = visitedCells;
    this.lastQueryStats.candidates = candidates;
    this.lastQueryStats.hits = hits.length;
    this.lastQueryStats.estimatedSpeedup = this.records.size / Math.max(1, candidates);
    return hits;
  }

  _place(entity, record) {
    const { x, y } = this._cellFor(entity);
    if (record.cellX === x && record.cellY === y) return;
    if (record.cellX !== null && record.cellY !== null) this.stats.incrementalUpdates += 1;
    this._removeFromCell(entity, record.cellX, record.cellY);
    const bucket = this._bucketFor(x, y, true);
    bucket.add(entity);
    record.cellX = x;
    record.cellY = y;
  }

  _cellFor(entity) {
    return {
      x: Math.floor((Number(entity.x) || 0) / this.cellSize),
      y: Math.floor((Number(entity.y) || 0) / this.cellSize)
    };
  }

  _bucketFor(x, y, create = false) {
    let column = this.cells.get(x);
    if (!column && create) {
      column = new Map();
      this.cells.set(x, column);
    }
    if (!column) return null;
    let bucket = column.get(y);
    if (!bucket && create) {
      bucket = new Set();
      column.set(y, bucket);
    }
    return bucket || null;
  }

  _removeFromCell(entity, x, y) {
    if (x == null || y == null) return;
    const column = this.cells.get(x);
    const bucket = column?.get(y);
    if (!bucket) return;
    bucket.delete(entity);
    if (bucket.size === 0) column.delete(y);
    if (column?.size === 0) this.cells.delete(x);
  }

  _installPropertyHooks(entity, record) {
    for (const property of ['x', 'y']) {
      const descriptor = Object.getOwnPropertyDescriptor(entity, property);
      if (descriptor && descriptor.configurable === false) continue;
      if (descriptor?.set === undefined && descriptor?.get && !('value' in descriptor)) continue;
      let current = descriptor?.get ? descriptor.get.call(entity) : entity[property];
      const enumerable = descriptor?.enumerable ?? true;
      const index = this;

      Object.defineProperty(entity, property, {
        configurable: true,
        enumerable,
        get() {
          return descriptor?.get ? descriptor.get.call(this) : current;
        },
        set(value) {
          if (descriptor?.set) {
            descriptor.set.call(this, value);
          } else {
            current = value;
          }
          index.update(this);
        }
      });

      record.descriptors.set(property, { descriptor, current: () => entity[property] });
    }
  }

  _restorePropertyHooks(entity, record) {
    for (const [property, saved] of record.descriptors) {
      const current = entity[property];
      if (saved.descriptor) {
        if ('value' in saved.descriptor) {
          Object.defineProperty(entity, property, {
            ...saved.descriptor,
            value: current
          });
        } else {
          Object.defineProperty(entity, property, saved.descriptor);
        }
      } else {
        Object.defineProperty(entity, property, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: current
        });
      }
    }
    record.descriptors.clear();
  }
}

export function createQueryNamespace(index = new EntitySpatialIndex()) {
  return {
    index,
    configure(options = {}) {
      this.index.clear();
      this.index = new EntitySpatialIndex(options);
      return this.index;
    },
    add(entity) {
      return this.index.add(entity);
    },
    remove(entity) {
      return this.index.remove(entity);
    },
    clear() {
      this.index.clear();
    },
    update(entity) {
      return this.index.update(entity);
    },
    inRadius(x, y, radius, filter = null) {
      return this.index.inRadius(x, y, radius, filter);
    },
    get lastQueryStats() {
      return this.index.lastQueryStats;
    }
  };
}

const Query = createQueryNamespace();

export { Query };
export default EntitySpatialIndex;
