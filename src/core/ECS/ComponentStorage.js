import { createOmniError } from '../OmniError.js';

const FIELD_ARRAYS = Object.freeze({
  f32: Float32Array,
  f64: Float64Array,
  i32: Int32Array,
  u32: Uint32Array,
  i16: Int16Array,
  u16: Uint16Array,
  i8: Int8Array,
  u8: Uint8Array,
  bool: Uint8Array
});

function createFieldArray(type, capacity) {
  const ArrayType = FIELD_ARRAYS[type];
  if (ArrayType) return new ArrayType(capacity);
  return new Array(capacity).fill(null);
}

function resetFieldValue(type) {
  if (FIELD_ARRAYS[type]) return 0;
  return null;
}

export class ComponentStorage {
  constructor(descriptor, capacity) {
    if (!descriptor?.name || !descriptor.fields) throw createOmniError('ECS', 'ComponentStorage requires a component descriptor.');
    this.name = descriptor.name;
    this.fieldsDescriptor = { ...descriptor.fields };
    this.capacity = capacity;
    this.length = 0;
    this.entityIds = new Uint32Array(capacity);
    this.indexByEntity = new Map();
    this.fields = {};

    for (const [field, type] of Object.entries(this.fieldsDescriptor)) {
      this.fields[field] = createFieldArray(type, capacity);
    }
  }

  has(entityId) {
    return this.indexByEntity.has(entityId);
  }

  indexOf(entityId) {
    return this.indexByEntity.get(entityId) ?? -1;
  }

  add(entityId, values = {}) {
    if (this.has(entityId)) {
      this.set(entityId, values);
      return this.indexOf(entityId);
    }
    if (this.length >= this.capacity) {
      throw createOmniError('ECS', `Component storage ${this.name} exceeded capacity ${this.capacity}.`);
    }

    const index = this.length;
    this.length += 1;
    this.entityIds[index] = entityId;
    this.indexByEntity.set(entityId, index);
    this._write(index, values);
    return index;
  }

  set(entityId, values = {}) {
    const index = this.indexOf(entityId);
    if (index < 0) throw createOmniError('ECS', `Entity ${entityId} does not have component ${this.name}.`);
    this._write(index, values);
  }

  get(entityId) {
    const index = this.indexOf(entityId);
    if (index < 0) return null;
    const result = {};
    for (const field of Object.keys(this.fieldsDescriptor)) result[field] = this.fields[field][index];
    return result;
  }

  remove(entityId) {
    const index = this.indexOf(entityId);
    if (index < 0) return false;

    const lastIndex = this.length - 1;
    const lastEntity = this.entityIds[lastIndex];
    if (index !== lastIndex) {
      this.entityIds[index] = lastEntity;
      for (const field of Object.keys(this.fieldsDescriptor)) {
        this.fields[field][index] = this.fields[field][lastIndex];
      }
      this.indexByEntity.set(lastEntity, index);
    }

    this._clear(lastIndex);
    this.entityIds[lastIndex] = 0;
    this.indexByEntity.delete(entityId);
    this.length -= 1;
    return true;
  }

  _write(index, values) {
    for (const [field, type] of Object.entries(this.fieldsDescriptor)) {
      const fallback = resetFieldValue(type);
      this.fields[field][index] = values[field] ?? fallback;
    }
  }

  _clear(index) {
    for (const [field, type] of Object.entries(this.fieldsDescriptor)) {
      this.fields[field][index] = resetFieldValue(type);
    }
  }
}

export default ComponentStorage;
