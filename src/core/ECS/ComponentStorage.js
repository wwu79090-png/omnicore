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

const DEFAULT_CAPACITY = 1024;

function normalizeCapacity(value, fallback = DEFAULT_CAPACITY) {
  const capacity = Math.floor(Number(value));
  if (!Number.isFinite(capacity) || capacity < 1) return fallback;
  return capacity;
}

function normalizeMaxCapacity(value, minimum) {
  const capacity = Math.floor(Number(value));
  if (!Number.isFinite(capacity)) return Number.MAX_SAFE_INTEGER;
  return Math.max(minimum, capacity);
}

function nextGrowCapacity(current, required, maxCapacity) {
  let capacity = Math.max(1, current);
  while (capacity < required && capacity < maxCapacity) {
    capacity = Math.min(maxCapacity, capacity * 2);
  }
  return capacity;
}

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
  constructor(descriptor, capacity = DEFAULT_CAPACITY, { autoGrow = true, maxCapacity = Number.MAX_SAFE_INTEGER } = {}) {
    if (!descriptor?.name || !descriptor.fields) throw createOmniError('ECS', 'ComponentStorage requires a component descriptor.');
    this.name = descriptor.name;
    this.fieldsDescriptor = { ...descriptor.fields };
    this.capacity = normalizeCapacity(capacity);
    this.maxCapacity = normalizeMaxCapacity(maxCapacity, this.capacity);
    this.autoGrow = autoGrow !== false;
    this.length = 0;
    this.entityIds = new Uint32Array(this.capacity);
    this.indexByEntity = new Map();
    this.fields = {};

    for (const [field, type] of Object.entries(this.fieldsDescriptor)) {
      this.fields[field] = createFieldArray(type, this.capacity);
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
    this.ensureCapacity(this.length + 1);

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

  ensureCapacity(requiredCapacity) {
    const required = normalizeCapacity(requiredCapacity, this.capacity);
    if (required <= this.capacity) return this.capacity;
    if (!this.autoGrow) {
      throw createOmniError('ECS', `Component storage ${this.name} exceeded capacity ${this.capacity}.`);
    }
    if (required > this.maxCapacity) {
      throw createOmniError('ECS', `Component storage ${this.name} exceeded max capacity ${this.maxCapacity}.`);
    }

    const capacity = nextGrowCapacity(this.capacity, required, this.maxCapacity);
    const entityIds = new Uint32Array(capacity);
    entityIds.set(this.entityIds.subarray(0, this.length));
    this.entityIds = entityIds;

    for (const [field, type] of Object.entries(this.fieldsDescriptor)) {
      this.fields[field] = growFieldArray(this.fields[field], type, capacity, this.length);
    }

    this.capacity = capacity;
    return this.capacity;
  }

  grow(requiredCapacity) {
    return this.ensureCapacity(requiredCapacity);
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

function growFieldArray(values, type, capacity, length) {
  const next = createFieldArray(type, capacity);
  if (FIELD_ARRAYS[type]) {
    next.set(values.subarray(0, length));
    return next;
  }
  for (let index = 0; index < length; index += 1) next[index] = values[index];
  return next;
}

export default ComponentStorage;
