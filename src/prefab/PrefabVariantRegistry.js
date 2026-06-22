import { createOmniError } from '../core/OmniError.js';

export class PrefabVariantRegistry {
  constructor({ prefabs = {}, variants = {} } = {}) {
    this.prefabs = new Map();
    this.variants = new Map();
    Object.entries(prefabs || {}).forEach(([id, prefab]) => this.register(id, prefab));
    Object.entries(variants || {}).forEach(([id, variant]) => this.variant(id, variant));
  }

  register(id, prefab = {}) {
    const key = normalizeId(id);
    this.prefabs.set(key, { id: key, ...clone(prefab) });
    return this;
  }

  variant(id, { base, overrides = {}, tags = [], meta = {} } = {}) {
    const key = normalizeId(id);
    this.variants.set(key, {
      id: key,
      base: normalizeId(base),
      overrides: clone(overrides),
      tags: normalizeArray(tags).map(String).sort(),
      meta: clone(meta || {})
    });
    return this;
  }

  resolve(id, seen = new Set()) {
    const key = normalizeId(id);
    if (this.prefabs.has(key)) return clone(this.prefabs.get(key));
    const variant = this.variants.get(key);
    if (!variant) throw createOmniError('PrefabVariantRegistry', `Prefab variant is not registered: ${key}`);
    if (seen.has(key)) {
      throw createOmniError('PrefabVariantRegistry', `Prefab variant inheritance cycle: ${[...seen, key].join(' -> ')}`);
    }
    seen.add(key);
    const base = this.resolve(variant.base, seen);
    seen.delete(key);
    return {
      ...mergePrefabNode(base, variant.overrides),
      id: key,
      base: variant.base,
      variant: key,
      tags: unique([...(base.tags || []), ...variant.tags]),
      meta: { ...(base.meta || {}), ...(variant.meta || {}) }
    };
  }

  instantiate(id, { idPrefix = 'prefab', overrides = {} } = {}) {
    const resolved = mergePrefabNode(this.resolve(id), overrides || {});
    return stampInstanceIds(`${idPrefix}/${normalizeId(id)}`, resolved);
  }

  manifest() {
    return {
      prefabs: [...this.prefabs.keys()].sort(),
      variants: [...this.variants.keys()].sort()
    };
  }
}

function mergePrefabNode(base = {}, override = {}) {
  const childOverrides = override.children && !Array.isArray(override.children) ? override.children : {};
  const next = {
    ...clone(base),
    ...clone(without(override, ['children', 'props', 'meta'])),
    props: { ...(base.props || {}), ...(override.props || {}) },
    meta: { ...(base.meta || {}), ...(override.meta || {}) }
  };
  const baseChildren = normalizeArray(base.children).map(clone);
  const overrideChildren = Array.isArray(override.children) ? override.children : [];
  next.children = mergeChildren(baseChildren, childOverrides, overrideChildren);
  return next;
}

function mergeChildren(baseChildren, childOverrides, overrideChildren) {
  const byId = new Map(baseChildren.map((child, index) => [child.id || child.name || `child-${index}`, child]));
  for (const [id, override] of Object.entries(childOverrides || {})) {
    byId.set(id, mergePrefabNode(byId.get(id) || { id }, override));
  }
  for (const child of overrideChildren || []) {
    const id = child.id || child.name;
    if (id && byId.has(id)) byId.set(id, mergePrefabNode(byId.get(id), child));
    else byId.set(id || `child-${byId.size}`, clone(child));
  }
  return [...byId.values()];
}

function stampInstanceIds(id, node = {}) {
  const stamped = clone(node);
  stamped.id = id;
  stamped.children = normalizeArray(node.children).map((child, index) => {
    const localId = child.id || child.name || `child-${index}`;
    return stampInstanceIds(`${id}/${localId}`, child);
  });
  return stamped;
}

function without(value = {}, keys = []) {
  const blocked = new Set(keys);
  return Object.fromEntries(Object.entries(value || {}).filter(([key]) => !blocked.has(key)));
}

function normalizeId(id) {
  return String(id || '').trim();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map(String))].sort();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default PrefabVariantRegistry;
