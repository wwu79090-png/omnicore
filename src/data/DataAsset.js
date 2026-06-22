export class DataAsset {
  constructor({
    id = 'asset',
    type = 'DataAsset',
    data = {},
    resourcePath = '',
    uid = null,
    parent = null
  } = {}) {
    this.id = String(id);
    this.type = String(type);
    this.data = clone(data || {});
    this.resourcePath = normalizePath(resourcePath || `${this.id}.asset.json`);
    this.uid = uid || `dataasset:${this.resourcePath}`;
    this.parent = parent;
    this.base = null;
  }

  static create(config = {}) {
    return new DataAsset(config);
  }

  variant(id, overrides = {}) {
    const variant = new DataAsset({
      id,
      type: overrides.type || this.type,
      data: deepMerge(this.data, overrides.data || {}),
      resourcePath: overrides.resourcePath || this.resourcePath,
      uid: overrides.uid || `dataasset:${normalizePath(overrides.resourcePath || `${id}.asset.json`)}`,
      parent: this.uid
    });
    variant.base = this;
    return variant;
  }

  resolve() {
    return {
      id: this.id,
      type: this.type,
      uid: this.uid,
      parent: this.parent,
      resourcePath: this.resourcePath,
      data: clone(this.data)
    };
  }

  toJSON() {
    return this.resolve();
  }
}

function normalizePath(value) {
  return String(value || '').replace(/\\/gu, '/');
}

function deepMerge(left = {}, right = {}) {
  if (Array.isArray(left) || Array.isArray(right)) return clone(right ?? left);
  if (!isPlainObject(left) || !isPlainObject(right)) return clone(right ?? left);
  const output = clone(left);
  for (const [key, value] of Object.entries(right)) {
    output[key] = isPlainObject(value) && isPlainObject(output[key])
      ? deepMerge(output[key], value)
      : clone(value);
  }
  return output;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default DataAsset;
