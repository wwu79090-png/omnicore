import ComponentStorage from './ComponentStorage.js';
import { createOmniError } from '../OmniError.js';

export class World {
  constructor({ capacity = 1024 } = {}) {
    this.capacity = capacity;
    this.nextEntityId = 1;
    this.alive = new Uint8Array(capacity + 1);
    this.freeEntities = new Uint32Array(capacity);
    this.freeCount = 0;
    this.components = new Map();
    this.systems = [];
  }

  registerComponent(descriptor) {
    if (this.components.has(descriptor.name)) return this.components.get(descriptor.name);
    const storage = new ComponentStorage(descriptor, this.capacity);
    this.components.set(descriptor.name, storage);
    return storage;
  }

  createEntity() {
    let entityId = this.nextEntityId;
    if (this.freeCount > 0) {
      this.freeCount -= 1;
      entityId = this.freeEntities[this.freeCount];
    }
    if (entityId > this.capacity) throw createOmniError('ECS', `World 超出实体容量：${this.capacity}`);
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
    return storage.add(entityId, values);
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

  _assertAlive(entityId) {
    if (!this.isAlive(entityId)) throw createOmniError('ECS', `实体未激活：${entityId}`);
  }
}

export default World;
