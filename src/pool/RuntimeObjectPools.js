import ObjectPool from './ObjectPool.js';
import { createOmniError } from '../core/OmniError.js';

const POOL_TYPES = ['Sprite', 'Tween', 'Particle', 'Event'];

function createDefaultObject(type) {
  return {
    type,
    active: false,
    visible: type === 'Sprite' || type === 'Particle',
    id: null
  };
}

function resetObject(item = {}) {
  for (const key of Object.keys(item)) {
    if (key === 'type') continue;
    delete item[key];
  }
  item.active = false;
  item.visible = false;
  item.id = null;
  return item;
}

function configureObject(item, values = {}) {
  Object.assign(item, values);
  item.active = true;
  if (item.type === 'Sprite' || item.type === 'Particle') item.visible = values.visible ?? true;
  return item;
}

/**
 * Runtime pool group covering the hot allocation classes used by gameplay.
 */
export function createRuntimeObjectPools({
  factories = {},
  resetters = {},
  warm = {}
} = {}) {
  const state = new Map();
  for (const type of POOL_TYPES) {
    const create = factories[type] || (() => createDefaultObject(type));
    const reset = resetters[type] || resetObject;
    const pool = new ObjectPool(create, reset, { warm: Number(warm[type] || 0) });
    state.set(type, {
      name: type,
      pool,
      acquired: 0,
      released: 0,
      reused: 0,
      created: pool.available.length
    });
  }

  const api = {
    acquire(type, values = {}) {
      const entry = state.get(type);
      if (!entry) throw createOmniError('Pool', `Unknown OmniCore runtime pool: ${type}`);
      const candidate = entry.pool.available[entry.pool.available.length - 1];
      const reused = Boolean(candidate?.__omnicoreReleasedOnce);
      const item = entry.pool.acquire();
      entry.acquired += 1;
      if (reused) entry.reused += 1;
      else entry.created += 1;
      return configureObject(item, values);
    },
    release(type, item) {
      const entry = state.get(type);
      if (!entry) throw createOmniError('Pool', `Unknown OmniCore runtime pool: ${type}`);
      if (!entry.pool.active.has(item)) return false;
      entry.pool.release(item);
      entry.pool.available[entry.pool.available.length - 1].__omnicoreReleasedOnce = true;
      entry.released += 1;
      return true;
    },
    get(type) {
      return state.get(type)?.pool || null;
    },
    report() {
      return {
        format: 'OmniCore.RuntimeObjectPools',
        types: POOL_TYPES.map((type) => {
          const entry = state.get(type);
          return {
            name: entry.name,
            acquired: entry.acquired,
            released: entry.released,
            reused: entry.reused,
            created: entry.created,
            active: entry.pool.active.size,
            available: entry.pool.available.length
          };
        })
      };
    }
  };

  for (const type of POOL_TYPES) api[type] = state.get(type).pool;
  return api;
}

export default createRuntimeObjectPools;
