import ComponentStorage from './ComponentStorage.js';
import { createOmniError } from '../OmniError.js';

const DEFAULT_WORLD_CAPACITY = 1024;

function normalizeCapacity(value, fallback = DEFAULT_WORLD_CAPACITY) {
  const capacity = Math.floor(Number(value));
  if (!Number.isFinite(capacity) || capacity < 1) return fallback;
  return capacity;
}

function normalizeMaxCapacity(value, minimum) {
  const capacity = Math.floor(Number(value));
  if (!Number.isFinite(capacity)) return Number.MAX_SAFE_INTEGER;
  return Math.max(minimum, capacity);
}

function normalizeGrowFactor(value) {
  const factor = Number(value);
  if (!Number.isFinite(factor) || factor <= 1) return 2;
  return factor;
}

function nextGrowCapacity(current, required, maxCapacity, growFactor) {
  let capacity = Math.max(1, current);
  while (capacity < required && capacity < maxCapacity) {
    capacity = Math.min(maxCapacity, Math.ceil(capacity * growFactor));
  }
  return capacity;
}

export class World {
  constructor({
    capacity = DEFAULT_WORLD_CAPACITY,
    autoGrow = true,
    maxCapacity = Number.MAX_SAFE_INTEGER,
    growFactor = 2
  } = {}) {
    this.capacity = normalizeCapacity(capacity);
    this.autoGrow = autoGrow !== false;
    this.maxCapacity = normalizeMaxCapacity(maxCapacity, this.capacity);
    this.growFactor = normalizeGrowFactor(growFactor);
    this.nextEntityId = 1;
    this.alive = new Uint8Array(this.capacity + 1);
    this.freeEntities = new Uint32Array(this.capacity);
    this.freeCount = 0;
    this.components = new Map();
    this.systems = [];
    this.entityTags = new Map();
    this.changedComponents = new Map();
  }

  registerComponent(descriptor) {
    if (this.components.has(descriptor.name)) return this.components.get(descriptor.name);
    const storage = new ComponentStorage(descriptor, this.capacity, {
      autoGrow: this.autoGrow,
      maxCapacity: this.maxCapacity
    });
    this.components.set(descriptor.name, storage);
    return storage;
  }

  createEntity() {
    let entityId = this.nextEntityId;
    if (this.freeCount > 0) {
      this.freeCount -= 1;
      entityId = this.freeEntities[this.freeCount];
    }
    this.ensureCapacity(entityId);
    this.nextEntityId = Math.max(this.nextEntityId, entityId + 1);
    this.alive[entityId] = 1;
    return entityId;
  }

  destroyEntity(entityId) {
    if (!this.isAlive(entityId)) return false;
    for (const storage of this.components.values()) storage.remove(entityId);
    this.alive[entityId] = 0;
    this.freeEntities[this.freeCount] = entityId;
    this.freeCount += 1;
    return true;
  }

  isAlive(entityId) {
    return this.alive[entityId] === 1;
  }

  addComponent(entityId, componentName, values = {}) {
    this._assertAlive(entityId);
    const storage = this.storage(componentName);
    const component = storage.add(entityId, values);
    this.markChanged(entityId, componentName);
    return component;
  }

  removeComponent(entityId, componentName) {
    return this.storage(componentName).remove(entityId);
  }

  getComponent(entityId, componentName) {
    return this.storage(componentName).get(entityId);
  }

  storage(componentName) {
    const storage = this.components.get(componentName);
    if (!storage) throw createOmniError('ECS', `组件尚未注册：${componentName}`);
    return storage;
  }

  query(componentNames = []) {
    const stores = componentNames.map((name) => this.storage(name));
    const primary = stores.reduce((smallest, storage) => (
      storage.length < smallest.length ? storage : smallest
    ), stores[0]);

    return {
      get length() {
        if (!primary) return 0;
        let count = 0;
        for (let index = 0; index < primary.length; index += 1) {
          const entityId = primary.entityIds[index];
          if (stores.every((storage) => storage.has(entityId))) count += 1;
        }
        return count;
      },
      forEach(callback) {
        if (!primary) return;
        for (let index = 0; index < primary.length; index += 1) {
          const entityId = primary.entityIds[index];
          if (stores.every((storage) => storage.has(entityId))) callback(entityId, stores);
        }
      }
    };
  }

  addSystem(system) {
    if (typeof system !== 'function') throw createOmniError('ECS', 'ECS system 必须是函数。');
    this.systems.push(system);
    return system;
  }

  update(delta, time = 0) {
    for (const system of this.systems) system(this, delta, time);
  }

  addTags(entityId, tags = []) {
    this._assertAlive(entityId);
    const current = this.entityTags.get(entityId) || new Set();
    for (const tag of Array.isArray(tags) ? tags : [tags]) current.add(tag);
    this.entityTags.set(entityId, current);
    return [...current];
  }

  getTags(entityId) {
    return [...(this.entityTags.get(entityId) || [])];
  }

  markChanged(entityId, componentName) {
    const changed = this.changedComponents.get(entityId) || new Set();
    changed.add(componentName);
    this.changedComponents.set(entityId, changed);
  }

  isChanged(entityId, componentName) {
    return Boolean(this.changedComponents.get(entityId)?.has(componentName));
  }

  clearChanged(entityId = null) {
    if (entityId == null) this.changedComponents.clear();
    else this.changedComponents.delete(entityId);
  }

  ensureCapacity(requiredCapacity) {
    const required = normalizeCapacity(requiredCapacity, this.capacity);
    if (required <= this.capacity) return this.capacity;
    if (!this.autoGrow) throw createOmniError('ECS', `World 超出实体容量：${this.capacity}`);
    if (required > this.maxCapacity) throw createOmniError('ECS', `World 超出最大实体容量：${this.maxCapacity}`);

    const capacity = nextGrowCapacity(this.capacity, required, this.maxCapacity, this.growFactor);
    const alive = new Uint8Array(capacity + 1);
    alive.set(this.alive);
    this.alive = alive;

    const freeEntities = new Uint32Array(capacity);
    freeEntities.set(this.freeEntities.subarray(0, this.freeCount));
    this.freeEntities = freeEntities;

    for (const storage of this.components.values()) storage.ensureCapacity(capacity);
    this.capacity = capacity;
    return this.capacity;
  }

  grow(requiredCapacity) {
    return this.ensureCapacity(requiredCapacity);
  }

  _assertAlive(entityId) {
    if (!this.isAlive(entityId)) throw createOmniError('ECS', `实体未激活：${entityId}`);
  }
}

export default World;
