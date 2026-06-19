import { createOmniError } from './OmniError.js';

const TRANSFORM_FIELDS = Object.freeze(['x', 'y', 'scaleX', 'scaleY', 'rotation', 'alpha', 'width', 'height']);
const TRANSFORM_STRIDE = TRANSFORM_FIELDS.length;
const DEFAULT_ALLOC_RESET_FIELDS = Object.freeze(['x', 'y', 'scale', 'components', '__listeners']);
const POOL_REPORT_EVERY = 60;
const POOL_MISS_WARN_THRESHOLD = 10;
const POOL_MISS_WARN_CONSECUTIVE = 2;

function createTransformView(arena, slot) {
  const base = slot * TRANSFORM_STRIDE;
  const view = {};
  TRANSFORM_FIELDS.forEach((field, offset) => {
    Object.defineProperty(view, field, {
      enumerable: true,
      get() {
        return arena[base + offset];
      },
      set(value) {
        arena[base + offset] = Number.isFinite(value) ? value : 0;
      }
    });
  });
  return view;
}

function resetTransform(arena, slot) {
  const base = slot * TRANSFORM_STRIDE;
  arena[base] = 0;
  arena[base + 1] = 0;
  arena[base + 2] = 1;
  arena[base + 3] = 1;
  arena[base + 4] = 0;
  arena[base + 5] = 1;
  arena[base + 6] = 0;
  arena[base + 7] = 0;
}

function defaultFactory(slot) {
  return {
    id: slot,
    texture: null,
    transform: null,
    visible: false
  };
}

function defaultReset(item) {
  if ('texture' in item) item.texture = null;
  if ('visible' in item) item.visible = false;
}

export class FixedMemoryPool {
  constructor(name, preAllocCount, {
    factory = defaultFactory,
    reset = defaultReset,
    resetFields = DEFAULT_ALLOC_RESET_FIELDS,
    debug = false,
    logger = null
  } = {}) {
    if (!name) throw createOmniError('Pool', 'Pool name is required.');
    if (!Number.isInteger(preAllocCount) || preAllocCount <= 0) {
      throw createOmniError('Pool', 'Pool capacity must be a positive integer.');
    }

    this.name = name;
    this.capacity = preAllocCount;
    this.factory = factory;
    this.reset = reset;
    this.resetFields = [...resetFields];
    this.debug = Boolean(debug);
    this.logger = logger;
    this.transforms = new Float32Array(preAllocCount * TRANSFORM_STRIDE);
    this.textureRefs = new Array(preAllocCount).fill(null);
    this.slots = new Array(preAllocCount);
    this.active = new Uint8Array(preAllocCount);
    this.freeStack = new Uint32Array(preAllocCount);
    this.freeCount = preAllocCount;
    this.freeHead = 0;
    this.freeTail = preAllocCount;
    this.activeCount = 0;
    this.created = 0;
    this._reportEvery = POOL_REPORT_EVERY;
    this._windowStats = { hits: 0, misses: 0 };
    this._totalStats = { hits: 0, misses: 0 };
    this._consecutiveMissWindow = 0;

    for (let slot = 0; slot < preAllocCount; slot += 1) {
      resetTransform(this.transforms, slot);
      this.freeStack[slot] = slot;
      const item = factory(slot) || {};
      this._attachSlot(item, slot);
      this.slots[slot] = item;
      this.created += 1;
    }
  }

  allocate() {
    const hasFree = this.freeCount > 0;
    if (this.freeCount <= 0) {
      this._recordAccess(false);
      throw createOmniError('Pool', `Pool ${this.name} exhausted fixed capacity ${this.capacity}.`);
    }
    const slot = this.freeStack[this.freeHead];
    this.freeHead = (this.freeHead + 1) % this.capacity;
    this.freeCount -= 1;
    const item = this.slots[slot];
    this.active[slot] = 1;
    this.activeCount += 1;
    this._applyAllocationReset(item);
    this._recordAccess(hasFree);
    return item;
  }

  free(item) {
    const slot = item?.__omnicorePoolSlot;
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.capacity || this.active[slot] === 0) return false;
    this.reset(item);
    resetTransform(this.transforms, slot);
    this.textureRefs[slot] = null;
    this.active[slot] = 0;
    this.freeStack[this.freeTail % this.capacity] = slot;
    this.freeTail = (this.freeTail + 1) % this.capacity;
    this.freeCount += 1;
    this.activeCount -= 1;
    return true;
  }

  _applyAllocationReset(item) {
    if (typeof item?.__reset === 'function') {
      item.__reset();
    }
    for (const field of this.resetFields) {
      const current = item?.[field];
      if (field === 'scale' && isScaleVector(current)) {
        current.set(0, 0);
        continue;
      }
      item[field] = getResetValue(current);
    }
  }

  stats() {
    return {
      name: this.name,
      capacity: this.capacity,
      available: this.freeCount,
      active: this.activeCount,
      created: this.created
    };
  }

  _attachSlot(item, slot) {
    const transformView = createTransformView(this.transforms, slot);
    if (item.transform == null) item.transform = transformView;
    Object.defineProperties(item, {
      __omnicorePoolSlot: {
        configurable: false,
        enumerable: false,
        value: slot
      },
      __omnicorePoolName: {
        configurable: false,
        enumerable: false,
        value: this.name
      },
      __omnicorePoolTransform: {
        configurable: false,
        enumerable: false,
        value: transformView
      }
    });
  }

  _recordAccess(hit) {
    if (!this.debug) return;
    if (hit) {
      this._windowStats.hits += 1;
      this._totalStats.hits += 1;
    } else {
      this._windowStats.misses += 1;
      this._totalStats.misses += 1;
    }

    const totalWindow = this._windowStats.hits + this._windowStats.misses;
    if (totalWindow < this._reportEvery) return;

    const hitRate = Number((this._windowStats.hits / totalWindow) * 100).toFixed(2);
    const missRate = Number((this._windowStats.misses / totalWindow) * 100).toFixed(2);
    const total = this._totalStats.hits + this._totalStats.misses;
    this.logger?.info?.(`[OmniCore:Pool] ${this.name}: Hit ${hitRate}% | Miss ${missRate}% | Total ${total}`);

    if (Number(missRate) > POOL_MISS_WARN_THRESHOLD) {
      this._consecutiveMissWindow += 1;
    } else {
      this._consecutiveMissWindow = 0;
    }
    if (this._consecutiveMissWindow >= POOL_MISS_WARN_CONSECUTIVE) {
      this.logger?.warn?.(`[OmniCore:Pool] ${this.name}: 命中率异常，Miss ${missRate}% 持续超过阈值。`);
    }

    this._windowStats.hits = 0;
    this._windowStats.misses = 0;
  }
}

export class PoolRegistry {
  constructor() {
    this.pools = new Map();
    this.debug = false;
    this.logger = null;
  }

  setDebug(debug) {
    this.debug = Boolean(debug);
    for (const pool of this.pools.values()) pool.debug = this.debug;
    return this;
  }

  setLogger(logger) {
    this.logger = logger;
    for (const pool of this.pools.values()) pool.logger = this.logger;
    return this;
  }

  create(name, preAllocCount, options = {}) {
    if (this.pools.has(name)) this.destroy(name);
    const pool = new FixedMemoryPool(name, preAllocCount, {
      ...options,
      debug: this.debug,
      logger: options.logger || this.logger
    });
    this.pools.set(name, pool);
    return pool;
  }

  get(name) {
    return this.pools.get(name) || null;
  }

  destroy(name) {
    return this.pools.delete(name);
  }

  clear() {
    this.pools.clear();
  }
}

const Pool = new PoolRegistry();

export { Pool, FixedMemoryPool as MemoryPool };

export default Pool;

function getResetValue(value) {
  if (Array.isArray(value)) return [];
  if (value == null) return null;
  if (typeof value === 'number') return 0;
  if (typeof value === 'boolean') return false;
  if (typeof value === 'string') return '';
  if (typeof value === 'object') return null;
  return null;
}

function isScaleVector(value) {
  return Boolean(value && typeof value === 'object' && typeof value.set === 'function');
}
