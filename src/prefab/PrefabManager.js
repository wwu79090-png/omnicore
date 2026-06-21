import { Scene, Sprite } from '../scene/Scene.js';
import Button from '../ui/Button.js';
import Node from '../node/Node.js';
import { createOmniError } from '../core/OmniError.js';

/**
 * JSON prefab instantiator with Cocos-style component mounting.
 *
 * @example
 * const enemy = PrefabManager.instantiate({
 *   type: 'sprite',
 *   texture: 'enemy',
 *   components: [{ type: EnemyAI, options: { speed: 90 } }]
 * }, 100, 200);
 */
function resolveComponent(type, registry = {}) {
  if (typeof type === 'function') return type;
  return registry.components?.[type] || registry[type];
}

export class PrefabManager {
  static instantiate(json, x = 0, y = 0, registry = {}, overrides = {}) {
    const resolved = PrefabManager._mergeOverride(json, overrides[''] || overrides[json.name] || {});
    let instance;
    if (resolved.type === 'button') instance = new Button(resolved.text || 'Button', { ...resolved, x, y });
    else if (resolved.type === 'scene') instance = new Scene(resolved.name || 'prefab-scene', resolved.options);
    else if (resolved.type === 'node') instance = new Node({ ...resolved, x, y, children: [] });
    else instance = new Sprite(resolved.texture, { ...resolved, x, y });

    Object.assign(instance, resolved.props || {});
    if (instance.props) instance.props = { ...instance.props, ...(resolved.props || {}) };
    instance.x = x;
    instance.y = y;
    if (resolved.name) instance.name = resolved.name;

    for (const component of resolved.components || []) {
      const Component = resolveComponent(component.type, registry);
      if (!Component) throw createOmniError('Prefab', `Prefab 组件尚未注册：${component.type}`);
      instance.addComponent(Component, component.options || {});
    }

    for (const child of resolved.children || []) {
      const path = child.name || child.id || '';
      const childOverrides = PrefabManager._selectChildOverrides(overrides, path);
      const childJson = PrefabManager._mergeOverride(child, overrides[path] || {});
      const childInstance = PrefabManager.instantiate(
        childJson,
        childJson.x ?? 0,
        childJson.y ?? 0,
        registry,
        childOverrides
      );
      if (typeof instance.addChild === 'function') instance.addChild(childInstance);
      else instance.add?.(childInstance);
    }

    return instance;
  }

  static validate(json = {}) {
    const errors = [];
    const warnings = [];
    validatePrefabNode(json, json.name || json.id || 'prefab', errors, warnings);
    return {
      ok: errors.length === 0,
      errors,
      warnings
    };
  }

  static collectDependencies(json = {}) {
    const buckets = createDependencyBuckets();
    collectPrefabDependencies(json, buckets);
    return sortDependencyBuckets(buckets);
  }

  static _mergeOverride(json, override = {}) {
    return {
      ...json,
      ...override,
      props: { ...(json.props || {}), ...(override.props || {}) },
      children: override.children || json.children || []
    };
  }

  static _selectChildOverrides(overrides, childPath) {
    const selected = {};
    for (const [path, override] of Object.entries(overrides || {})) {
      if (!childPath) continue;
      if (path === childPath) selected[''] = override;
      else if (path.startsWith(`${childPath}/`)) selected[path.slice(childPath.length + 1)] = override;
    }
    return selected;
  }
}

const DEPENDENCY_BUCKETS = ['audio', 'data', 'fonts', 'images', 'models', 'prefabs'];

function validatePrefabNode(node = {}, path = 'prefab', errors = [], warnings = []) {
  if (!node || typeof node !== 'object') {
    errors.push({
      code: 'invalid-prefab-node',
      path,
      message: 'Prefab node must be an object.'
    });
    return;
  }

  for (const component of node.components || []) {
    if (!component?.type) {
      errors.push({
        code: 'invalid-component',
        path: `${path}.components`,
        message: 'Prefab component requires a type.'
      });
    }
  }

  const siblingNames = new Set();
  for (const child of node.children || []) {
    const name = child?.name || child?.id || '';
    const childPath = name ? `${path}/${name}` : `${path}/child`;
    if (name) {
      if (siblingNames.has(name)) {
        errors.push({
          code: 'duplicate-child-name',
          path: childPath,
          message: `Prefab child name "${name}" is duplicated under ${path}.`
        });
      }
      siblingNames.add(name);
    } else {
      warnings.push({
        code: 'anonymous-child',
        path: childPath,
        message: 'Prefab child has no stable name or id.'
      });
    }
    validatePrefabNode(child, childPath, errors, warnings);
  }
}

function collectPrefabDependencies(node, buckets) {
  const source = node || {};
  if (!source || typeof source !== 'object') return;
  if (source.texture) addDependency(buckets, source.texture, 'images');
  if (source.prefab) addDependency(buckets, source.prefab, 'prefabs');
  if (source.model) addDependency(buckets, source.model, 'models');
  if (source.src || source.source) addDependency(buckets, source.src || source.source);
  scanValueForDependencies(source.props, buckets);
  for (const component of source.components || []) scanValueForDependencies(component.options || component.props, buckets);
  for (const child of source.children || []) collectPrefabDependencies(child, buckets);
}

function scanValueForDependencies(value, buckets, key) {
  const dependencyKey = key || '';
  if (value == null) return;
  if (typeof value === 'string') {
    const bucket = inferDependencyBucket(value, dependencyKey);
    if (bucket) addDependency(buckets, value, bucket);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => scanValueForDependencies(item, buckets, dependencyKey));
    return;
  }
  if (typeof value !== 'object') return;
  for (const [childKey, childValue] of Object.entries(value)) {
    if (['id', 'name', 'type'].includes(childKey)) continue;
    scanValueForDependencies(childValue, buckets, childKey);
  }
}

function addDependency(buckets, value, forcedBucket = null) {
  const key = assetToKey(value);
  if (!key) return;
  const bucket = forcedBucket || inferDependencyBucket(key);
  if (!bucket) return;
  buckets[bucket].add(key);
}

function inferDependencyBucket(value, key = '') {
  const text = String(value || '');
  const lowerKey = String(key || '').toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(text)) return 'images';
  if (/\.(mp3|ogg|wav|m4a|webm)$/iu.test(text)) return 'audio';
  if (/\.(glb|gltf|blend|fbx|obj)$/iu.test(text)) return 'models';
  if (/\.(json|csv|tmx)$/iu.test(text)) return 'data';
  if (/\.(fnt|ttf|otf|woff2?|font)$/iu.test(text) || lowerKey.includes('font')) return 'fonts';
  if (lowerKey.includes('prefab')) return 'prefabs';
  return null;
}

function createDependencyBuckets() {
  return Object.fromEntries(DEPENDENCY_BUCKETS.map((bucket) => [bucket, new Set()]));
}

function sortDependencyBuckets(buckets) {
  return Object.fromEntries(
    DEPENDENCY_BUCKETS.map((bucket) => [
      bucket,
      Array.from(buckets[bucket] || []).map(assetToKey).filter(Boolean).sort()
    ])
  );
}

function assetToKey(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.replace(/\\/gu, '/');
  return String(value.key || value.id || value.url || value.path || value.src || value.name || '').replace(/\\/gu, '/');
}

export default PrefabManager;
