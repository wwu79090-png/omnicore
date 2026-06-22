import { createOmniError } from '../core/OmniError.js';

export class EditorSceneDependencyGraph {
  constructor({ nodes = [], assets = [], prefabs = [] } = {}) {
    this.nodes = new Map(nodes.map((node) => [String(node.id), clone(node)]));
    this.assets = new Map(assets.map((asset) => [String(asset.id), clone(asset)]));
    this.prefabs = new Map(prefabs.map((prefab) => [String(prefab.id), clone(prefab)]));
  }

  inspectNode(id) {
    const node = this._requireNode(id);
    const components = clone(node.components || {});
    const componentNames = Object.keys(components).sort();
    const assetRefs = collectAssetRefs(node);
    const prefabRefs = node.prefab ? [String(node.prefab)] : [];
    return {
      ...clone(node),
      id: node.id,
      components,
      componentNames,
      assetRefs,
      prefabRefs
    };
  }

  applyPropertyPatch(nodeId, path, value) {
    const node = this._requireNode(nodeId);
    setPath(node, path, value);
    return this.inspectNode(nodeId);
  }

  buildDependencyGraph() {
    const nodes = {};
    for (const [id, node] of this.nodes.entries()) {
      const assetRefs = collectAssetRefs(node);
      const prefabRefs = node.prefab ? [String(node.prefab)] : [];
      const children = normalizeArray(node.children).map(String);
      nodes[id] = {
        id,
        dependencies: unique([...assetRefs, ...prefabRefs, ...children])
      };
    }
    return {
      nodes,
      assets: Object.fromEntries([...this.assets.entries()].map(([id, asset]) => [id, clone(asset)])),
      prefabs: Object.fromEntries([...this.prefabs.entries()].map(([id, prefab]) => [id, clone(prefab)]))
    };
  }

  planHotReload(assetId) {
    const asset = String(assetId);
    const affectedPrefabs = [...this.prefabs.values()]
      .filter((prefab) => normalizeArray(prefab.assets).map(String).includes(asset))
      .map((prefab) => String(prefab.id));
    const affectedPrefabSet = new Set(affectedPrefabs);
    const affectedNodes = [...this.nodes.values()]
      .filter((node) => collectAssetRefs(node).includes(asset) || affectedPrefabSet.has(String(node.prefab)))
      .map((node) => String(node.id));

    return {
      asset,
      affectedNodes,
      affectedPrefabs,
      actions: [
        `reloadAsset:${asset}`,
        ...affectedNodes.map((nodeId) => `refreshNode:${nodeId}`),
        ...affectedPrefabs.map((prefabId) => `reinstantiatePrefab:${prefabId}`)
      ]
    };
  }

  _requireNode(id) {
    const node = this.nodes.get(String(id));
    if (!node) {
      throw createOmniError('EditorSceneDependencyGraph', `Node not found: ${id}`, {
        code: 'OMNICORE_EDITOR_SCENE_NODE_NOT_FOUND'
      });
    }
    return node;
  }
}

function collectAssetRefs(node = {}) {
  return unique([
    ...collectStringAssets(node.components),
    ...normalizeArray(node.assets).map(String)
  ]);
}

function collectStringAssets(value) {
  if (value == null) return [];
  if (typeof value === 'string') return looksLikeAsset(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(collectStringAssets);
  if (typeof value !== 'object') return [];
  return Object.values(value).flatMap(collectStringAssets);
}

function looksLikeAsset(value) {
  return /\.(png|jpg|jpeg|webp|gif|svg|json|atlas|glb|gltf|mp3|ogg|wav)$/i.test(value);
}

function setPath(target, path, value) {
  const parts = String(path || '').split('.').filter(Boolean);
  if (!parts.length) return;
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (cursor[part] == null || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function unique(values) {
  return [...new Set(values.filter((value) => value != null).map(String))];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default EditorSceneDependencyGraph;
