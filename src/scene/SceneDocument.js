/**
 * Versioned scene document helpers for editor saves, migration imports, and dependency collection.
 */
import { createOmniError } from '../core/OmniError.js';

export const SCENE_DOCUMENT_SCHEMA = 'omnicore.scene-document.v1';
export const SCENE_DOCUMENT_VERSION = 1;

const DEPENDENCY_BUCKETS = ['audio', 'data', 'fonts', 'images', 'models', 'prefabs'];
const TRANSFORM_FIELDS = ['x', 'y', 'z', 'rotation', 'scaleX', 'scaleY'];

export class SceneDocument {
  constructor(document = {}) {
    this.document = normalizeSceneDocument(document);
  }

  validate() {
    return validateSceneDocument(this.document);
  }

  dependencies() {
    return collectSceneDependencies(this.document);
  }

  toJSON() {
    return clone(this.document);
  }
}

export function normalizeSceneDocument(input = {}) {
  const source = clone(input || {});
  const children = source.children || source.nodes || source.objects || source.entities || [];
  const assets = normalizeSceneAssets(source.assets || source.dependencies || {});
  for (const prefab of normalizeArray(source.prefabs || [])) {
    const key = assetToKey(prefab);
    if (key && !assets.prefabs.includes(key)) assets.prefabs.push(key);
  }
  assets.prefabs.sort();

  return {
    schema: SCENE_DOCUMENT_SCHEMA,
    schemaVersion: SCENE_DOCUMENT_VERSION,
    name: source.name || source.id || 'scene',
    uid: source.uid || createSceneUid(source.resourcePath || source.path || source.name || source.id || 'scene'),
    resourcePath: normalizePath(source.resourcePath || source.path || ''),
    inherits: source.inherits ? clone(source.inherits) : null,
    instanceOverrides: clone(source.instanceOverrides || source.overrides || {}),
    meta: clone(source.meta || {}),
    assets,
    children: normalizeArray(children).map((node, index) => normalizeSceneNode(node, `node-${index}`))
  };
}

export function instantiateSceneDocument(input = {}, options = {}) {
  const source = typeof input?.toJSON === 'function' ? input.toJSON() : input;
  const document = normalizeSceneDocument(source);
  const sceneUid = options.uid || document.uid || createSceneUid(document.resourcePath || document.name);
  const inherited = document.inherits && typeof document.inherits === 'object'
    ? instantiateSceneDocument(document.inherits)
    : null;
  const byId = new Map();

  for (const child of inherited?.children || []) {
    byId.set(child.id, rebaseInheritedNode(child, sceneUid));
  }

  for (const child of document.children || []) {
    const materialized = materializeSceneNode(child, sceneUid);
    const previous = byId.get(materialized.id);
    byId.set(materialized.id, previous ? mergeSceneNodes(previous, materialized, sceneUid) : materialized);
  }

  const children = [...byId.values()].map((node) => applyInstanceOverride(node, document.instanceOverrides?.[node.id]));

  return {
    schema: document.schema,
    schemaVersion: document.schemaVersion,
    name: document.name,
    uid: sceneUid,
    resourcePath: document.resourcePath,
    inheritedFrom: inherited?.uid || null,
    meta: clone(document.meta || {}),
    assets: mergeSceneAssets(inherited?.assets, document.assets),
    children
  };
}

export function validateSceneDocument(input = {}) {
  const document = input?.schema === SCENE_DOCUMENT_SCHEMA ? input : normalizeSceneDocument(input);
  const errors = [];
  const warnings = [];
  const ids = new Set();

  if (document.schema !== SCENE_DOCUMENT_SCHEMA) {
    errors.push({
      code: 'invalid-scene-schema',
      path: '$',
      message: `Scene document schema must be ${SCENE_DOCUMENT_SCHEMA}.`
    });
  }
  if (!Array.isArray(document.children)) {
    errors.push({
      code: 'invalid-scene-children',
      path: '$.children',
      message: 'Scene document children must be an array.'
    });
  }

  for (const child of document.children || []) {
    validateSceneNode(child, document.name || 'scene', { ids, errors, warnings });
  }

  return {
    ok: errors.length === 0,
    schema: SCENE_DOCUMENT_SCHEMA,
    schemaVersion: SCENE_DOCUMENT_VERSION,
    errors,
    warnings
  };
}

export function collectSceneDependencies(input = {}) {
  const document = input?.schema === SCENE_DOCUMENT_SCHEMA ? input : normalizeSceneDocument(input);
  const buckets = createDependencyBuckets();
  mergeAssetDeclarations(buckets, document.assets || {});
  for (const child of document.children || []) collectNodeDependencies(child, buckets);
  return sortDependencyBuckets(buckets);
}

function normalizeSceneNode(input = {}, fallbackId = 'node') {
  const node = clone(input || {});
  const id = node.id || node.name || fallbackId;
  const type = node.type || (node.prefab ? 'prefab' : (node.texture ? 'sprite' : 'node'));
  const normalized = {
    id: String(id),
    name: node.name || String(id),
    type,
    visible: node.visible !== false,
    zIndex: Number(node.zIndex || 0),
    transform: normalizeTransform(node.transform || node),
    props: clone(node.props || {}),
    components: normalizeComponents(node.components || [])
  };

  copyIfDefined(normalized, node, ['texture', 'prefab', 'model', 'src', 'source', 'text']);

  const children = node.children || node.nodes || [];
  normalized.children = normalizeArray(children).map((child, index) => normalizeSceneNode(child, `${id}-${index}`));
  return normalized;
}

function normalizeSceneAssets(assets = {}) {
  if (Array.isArray(assets)) {
    const buckets = createDependencyBuckets();
    for (const asset of assets) addDependency(buckets, asset);
    return sortDependencyBuckets(buckets);
  }
  const normalized = {};
  for (const bucket of DEPENDENCY_BUCKETS) {
    normalized[bucket] = normalizeArray(assets[bucket] || assets[singular(bucket)] || [])
      .map(assetToKey)
      .filter(Boolean);
  }
  return sortDependencyBuckets(normalized);
}

function normalizeTransform(source = {}) {
  const scale = Number(source.scale ?? 1);
  return {
    x: normalizeNumber(source.x, 0),
    y: normalizeNumber(source.y, 0),
    z: normalizeNumber(source.z, 0),
    rotation: normalizeNumber(source.rotation, 0),
    scaleX: normalizeNumber(source.scaleX, scale),
    scaleY: normalizeNumber(source.scaleY, scale)
  };
}

function normalizeComponents(components = []) {
  if (Array.isArray(components)) {
    return components.map((component) => {
      if (typeof component === 'string') return { type: component, options: {} };
      return {
        type: String(component.type || component.name || ''),
        options: clone(component.options || component.props || {})
      };
    }).filter((component) => component.type);
  }
  return Object.entries(components || {}).map(([type, options]) => ({
    type,
    options: clone(options || {})
  }));
}

function validateSceneNode(node, path, state) {
  const nodePath = `${path}/${node?.id || node?.name || 'node'}`;
  if (!node?.id) {
    state.errors.push({
      code: 'missing-node-id',
      path: nodePath,
      message: 'Scene node requires a stable id.'
    });
  } else if (state.ids.has(String(node.id))) {
    state.errors.push({
      code: 'duplicate-node-id',
      path: nodePath,
      message: `Scene node id "${node.id}" appears more than once.`
    });
  } else {
    state.ids.add(String(node.id));
  }

  for (const field of TRANSFORM_FIELDS) {
    const value = Number(node?.transform?.[field]);
    if (!Number.isFinite(value)) {
      state.errors.push({
        code: 'invalid-node-transform',
        path: `${nodePath}.transform.${field}`,
        message: `Scene node transform field ${field} must be finite.`
      });
    }
  }

  for (const component of node?.components || []) {
    if (!component?.type) {
      state.errors.push({
        code: 'invalid-node-component',
        path: `${nodePath}.components`,
        message: 'Scene node component requires a type.'
      });
    }
  }

  for (const child of node?.children || []) validateSceneNode(child, nodePath, state);
}

function collectNodeDependencies(node, buckets) {
  if (!node) return;
  if (node.texture) addDependency(buckets, node.texture, 'images');
  if (node.prefab) addDependency(buckets, node.prefab, 'prefabs');
  if (node.model) addDependency(buckets, node.model, 'models');
  if (node.src || node.source) addDependency(buckets, node.src || node.source);
  scanValueForDependencies(node.props, buckets);
  for (const component of node.components || []) scanValueForDependencies(component.options, buckets);
  for (const child of node.children || []) collectNodeDependencies(child, buckets);
}

function scanValueForDependencies(value, buckets, key = '') {
  if (value == null) return;
  if (typeof value === 'string') {
    const inferred = inferDependencyBucket(value, key);
    if (inferred) addDependency(buckets, value, inferred);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => scanValueForDependencies(item, buckets, key));
    return;
  }
  if (typeof value !== 'object') return;
  for (const [childKey, childValue] of Object.entries(value)) {
    if (['id', 'name', 'type'].includes(childKey)) continue;
    scanValueForDependencies(childValue, buckets, childKey);
  }
}

function mergeAssetDeclarations(buckets, assets = {}) {
  for (const bucket of DEPENDENCY_BUCKETS) {
    for (const asset of normalizeArray(assets[bucket] || [])) addDependency(buckets, asset, bucket);
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

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function copyIfDefined(target, source, fields) {
  for (const field of fields) {
    if (typeof source[field] !== 'undefined') target[field] = source[field];
  }
}

function assetToKey(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.replace(/\\/gu, '/');
  return String(value.key || value.id || value.url || value.path || value.src || value.name || '').replace(/\\/gu, '/');
}

function createSceneUid(value) {
  return `scene:${normalizePath(value || 'scene')}`;
}

function normalizePath(value) {
  return String(value || '').replace(/\\/gu, '/');
}

function materializeSceneNode(node = {}, sceneUid = 'scene:scene') {
  const materialized = clone(node);
  materialized.uid = `${sceneUid}#${materialized.id}`;
  materialized.children = (node.children || []).map((child) => materializeSceneNode(child, sceneUid));
  return materialized;
}

function rebaseInheritedNode(node = {}, sceneUid = 'scene:scene') {
  const rebased = clone(node);
  rebased.inheritedFrom = node.uid || node.inheritedFrom || null;
  rebased.uid = `${sceneUid}#${rebased.id}`;
  rebased.children = (node.children || []).map((child) => rebaseInheritedNode(child, sceneUid));
  return rebased;
}

function mergeSceneNodes(baseNode = {}, overrideNode = {}, sceneUid = 'scene:scene') {
  const merged = deepMerge(baseNode, overrideNode);
  merged.uid = `${sceneUid}#${merged.id}`;
  const children = new Map();
  for (const child of baseNode.children || []) children.set(child.id, child);
  for (const child of overrideNode.children || []) {
    children.set(child.id, children.has(child.id) ? mergeSceneNodes(children.get(child.id), child, sceneUid) : child);
  }
  merged.children = [...children.values()];
  if (baseNode.uid && baseNode.uid !== merged.uid) merged.inheritedFrom = baseNode.inheritedFrom || baseNode.uid;
  return merged;
}

function applyInstanceOverride(node = {}, override = null) {
  const next = override ? deepMerge(node, override) : clone(node);
  next.children = (next.children || []).map((child) => applyInstanceOverride(child, override?.children?.[child.id] || null));
  return next;
}

function mergeSceneAssets(left = null, right = null) {
  const buckets = createDependencyBuckets();
  mergeAssetDeclarations(buckets, left || {});
  mergeAssetDeclarations(buckets, right || {});
  return sortDependencyBuckets(buckets);
}

function deepMerge(left = {}, right = {}) {
  if (Array.isArray(left) || Array.isArray(right)) return clone(right ?? left);
  if (!isPlainObject(left) || !isPlainObject(right)) return clone(right ?? left);
  const merged = clone(left);
  for (const [key, value] of Object.entries(right)) {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = deepMerge(merged[key], value);
    } else {
      merged[key] = clone(value);
    }
  }
  return merged;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function singular(bucket) {
  return bucket.replace(/s$/u, '');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export function assertValidSceneDocument(document) {
  const report = validateSceneDocument(document);
  if (!report.ok) {
    throw createOmniError('SceneDocument', report.errors.map((error) => error.message).join('\n'), {
      code: 'SCENE_DOCUMENT_INVALID',
      details: report
    });
  }
  return document;
}

export default SceneDocument;
