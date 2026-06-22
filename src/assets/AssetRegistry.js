/**
 * Searchable asset registry for unloaded assets, stable ids, dependency queries, and editor repair plans.
 */
export const ASSET_REGISTRY_AUDIT_SCHEMA = 'omnicore.asset-registry-audit.v1';

export class AssetRegistry {
  constructor({ assets = [] } = {}) {
    this.assets = assets.map(normalizeAsset);
    this.indices = buildIndices(this.assets);
  }

  static create(config = {}) {
    return new AssetRegistry(config);
  }

  static crossEngineProfile() {
    return {
      sources: [
        'Unreal Asset Registry',
        'Unity AssetDatabase',
        'Godot ResourceLoader',
        'Cocos Creator Meta UUID'
      ],
      capabilities: [
        'unloaded-asset-search',
        'stable-uid-resolution',
        'recursive-dependency-query',
        'reverse-reference-query',
        'missing-reference-audit',
        'meta-guid-conflict-audit',
        'move-rename-repair-plan'
      ]
    };
  }

  crossEngineProfile() {
    return AssetRegistry.crossEngineProfile();
  }

  resolve(reference) {
    const match = this._resolveDetailed(reference);
    return match ? clone(match.asset) : null;
  }

  query({
    type = null,
    labels = [],
    tags = {},
    pathPrefix = '',
    bundle = null,
    packageName = null,
    unloadedOnly = false,
    loaded = null
  } = {}) {
    const normalizedLabels = normalizeArray(labels).map(normalizeRef);
    const normalizedTags = normalizeTags(tags);
    const normalizedPathPrefix = normalizePath(pathPrefix);
    const normalizedType = type ? normalizeType(type) : null;
    const normalizedBundle = bundle ? normalizeRef(bundle) : null;
    const normalizedPackage = packageName ? normalizeRef(packageName) : null;

    return this.assets
      .filter((asset) => {
        if (normalizedType && normalizeType(asset.type) !== normalizedType) return false;
        if (normalizedBundle && asset.bundle !== normalizedBundle) return false;
        if (normalizedPackage && asset.packageName !== normalizedPackage) return false;
        if (unloadedOnly && asset.loaded) return false;
        if (loaded != null && asset.loaded !== Boolean(loaded)) return false;
        if (normalizedPathPrefix && !asset.path.startsWith(normalizedPathPrefix)) return false;
        if (normalizedLabels.length && !normalizedLabels.every((label) => asset.labels.includes(label))) return false;
        return Object.entries(normalizedTags).every(([key, value]) => asset.tags[key] === value);
      })
      .map(clone);
  }

  getDependencies(reference, { recursive = false, includeMissing = false } = {}) {
    const root = this._resolveDetailed(reference);
    if (!root) {
      return includeMissing ? [{ asset: normalizeRef(reference), missing: true, depth: 0, via: null }] : [];
    }

    const result = [];
    const visitedAssets = new Set();
    const visitedMissing = new Set();

    const walk = (asset, depth) => {
      for (const dependencyRef of asset.dependencies) {
        const resolved = this._resolveDetailed(dependencyRef);
        if (!resolved) {
          if (includeMissing) {
            const missingKey = `${asset.key}:${dependencyRef}`;
            if (!visitedMissing.has(missingKey)) {
              visitedMissing.add(missingKey);
              result.push({
                asset: dependencyRef,
                missing: true,
                depth: depth + 1,
                via: asset.key
              });
            }
          }
          continue;
        }

        const dependency = resolved.asset;
        if (!visitedAssets.has(dependency.key)) {
          visitedAssets.add(dependency.key);
          result.push({
            asset: dependency.key,
            reference: dependencyRef,
            resolvedBy: resolved.resolvedBy,
            missing: false,
            depth: depth + 1,
            via: asset.key
          });
          if (recursive) walk(dependency, depth + 1);
        }
      }
    };

    walk(root.asset, 0);
    return result.map(clone);
  }

  getReferencers(reference, { recursive = false } = {}) {
    const target = this._resolveDetailed(reference);
    if (!target) return [];

    const result = [];
    const visited = new Set();
    const reverse = this._reverseDependencyMap();

    const walk = (asset, depth) => {
      const referencers = reverse.get(asset.key) || [];
      for (const referencer of referencers) {
        if (visited.has(referencer.source.key)) continue;
        visited.add(referencer.source.key);
        result.push({
          asset: referencer.source.key,
          reference: referencer.reference,
          depth: depth + 1,
          via: asset.key
        });
        if (recursive) walk(referencer.source, depth + 1);
      }
    };

    walk(target.asset, 0);
    return result.map(clone);
  }

  planMove(reference, nextPath) {
    const resolved = this._resolveDetailed(reference);
    if (!resolved) return null;
    const { asset } = resolved;
    const stableUid = asset.uid || normalizeRef(reference);
    const affected = this.getReferencers(asset.key, { recursive: false });
    return {
      asset: asset.key,
      from: asset.path,
      to: normalizePath(nextPath),
      stableUid,
      affectedAssets: affected.map((edge) => edge.asset).sort(),
      rewriteActions: affected.map((edge) => ({
        type: 'rewriteDependency',
        source: edge.asset,
        from: edge.reference,
        to: stableUid
      }))
    };
  }

  audit({ entrypoints = [] } = {}) {
    const duplicateUids = this._duplicateUids();
    const dependencyAudit = this._auditDependencies();
    const reachable = this._reachableAssets(entrypoints);
    const orphanAssets = this.assets
      .filter((asset) => reachable.size > 0 && !reachable.has(asset.key))
      .map((asset) => asset.key)
      .sort();
    const cycles = this._detectCycles();
    const ready = dependencyAudit.missingReferences.length === 0 && duplicateUids.length === 0 && cycles.length === 0;

    return {
      schema: ASSET_REGISTRY_AUDIT_SCHEMA,
      summary: {
        assetCount: this.assets.length,
        missingReferenceCount: dependencyAudit.missingReferences.length,
        duplicateUidCount: duplicateUids.length,
        orphanAssetCount: orphanAssets.length,
        cycleCount: cycles.length,
        ready
      },
      missingReferences: dependencyAudit.missingReferences,
      duplicateUids,
      orphanAssets,
      cycles,
      crossEngineProfile: this.crossEngineProfile()
    };
  }

  snapshot() {
    const dependencies = Object.fromEntries(
      this.assets.map((asset) => [
        asset.key,
        this.getDependencies(asset.key, { recursive: false, includeMissing: true })
      ])
    );
    const referencers = Object.fromEntries(
      this.assets.map((asset) => [
        asset.key,
        this.getReferencers(asset.key, { recursive: false })
      ])
    );
    return {
      schema: 'omnicore.asset-registry-snapshot.v1',
      assets: this.assets.map(clone),
      dependencies,
      referencers
    };
  }

  _resolveDetailed(reference) {
    const key = normalizeRef(reference);
    const lookups = [
      ['uid', this.indices.byUid],
      ['primaryId', this.indices.byPrimaryId],
      ['address', this.indices.byAddress],
      ['path', this.indices.byPath],
      ['id', this.indices.byId],
      ['key', this.indices.byKey]
    ];

    for (const [resolvedBy, index] of lookups) {
      const assets = index.get(key);
      if (assets?.length) return { asset: assets[0], resolvedBy };
    }
    return null;
  }

  _reverseDependencyMap() {
    const reverse = new Map();
    for (const asset of this.assets) {
      for (const reference of asset.dependencies) {
        const resolved = this._resolveDetailed(reference);
        if (!resolved) continue;
        if (!reverse.has(resolved.asset.key)) reverse.set(resolved.asset.key, []);
        reverse.get(resolved.asset.key).push({ source: asset, reference });
      }
    }
    return reverse;
  }

  _duplicateUids() {
    return [...this.indices.byUid.entries()]
      .filter(([uid, assets]) => uid && assets.length > 1)
      .map(([uid, assets]) => ({
        uid,
        assets: assets.map((asset) => asset.key).sort(),
        severity: 'error'
      }))
      .sort((left, right) => left.uid.localeCompare(right.uid));
  }

  _auditDependencies() {
    const missingReferences = [];
    for (const asset of this.assets) {
      for (const reference of asset.dependencies) {
        if (!this._resolveDetailed(reference)) {
          missingReferences.push({
            source: asset.key,
            reference,
            severity: 'error'
          });
        }
      }
    }
    return {
      missingReferences: missingReferences.sort((left, right) => {
        const sourceOrder = left.source.localeCompare(right.source);
        return sourceOrder || left.reference.localeCompare(right.reference);
      })
    };
  }

  _reachableAssets(entrypoints) {
    const roots = normalizeArray(entrypoints)
      .map((entrypoint) => this._resolveDetailed(entrypoint)?.asset)
      .filter(Boolean);
    if (!roots.length) return new Set();

    const reachable = new Set();
    const walk = (asset) => {
      if (reachable.has(asset.key)) return;
      reachable.add(asset.key);
      for (const edge of this.getDependencies(asset.key, { recursive: false })) {
        const dependency = this._resolveDetailed(edge.asset)?.asset;
        if (dependency) walk(dependency);
      }
    };

    for (const root of roots) walk(root);
    return reachable;
  }

  _detectCycles() {
    const cycles = [];
    const visiting = new Set();
    const visited = new Set();

    const walk = (asset, stack) => {
      if (visiting.has(asset.key)) {
        const start = stack.indexOf(asset.key);
        if (start >= 0) cycles.push([...stack.slice(start), asset.key]);
        return;
      }
      if (visited.has(asset.key)) return;

      visiting.add(asset.key);
      for (const edge of this.getDependencies(asset.key, { recursive: false })) {
        const dependency = this._resolveDetailed(edge.asset)?.asset;
        if (dependency) walk(dependency, [...stack, dependency.key]);
      }
      visiting.delete(asset.key);
      visited.add(asset.key);
    };

    for (const asset of this.assets) walk(asset, [asset.key]);
    return uniqueCycleList(cycles);
  }
}

function normalizeAsset(entry = {}) {
  const uid = entry.uid ? normalizeRef(entry.uid) : null;
  const primaryId = entry.primaryId || entry.primaryAssetId ? normalizeRef(entry.primaryId || entry.primaryAssetId) : null;
  const address = entry.address ? normalizeRef(entry.address) : null;
  const path = normalizePath(entry.path || entry.url || entry.src || '');
  const id = normalizeRef(entry.id || entry.key || address || primaryId || uid || path);
  const key = address || primaryId || path || uid || id;
  return {
    id,
    key,
    uid,
    primaryId,
    address,
    path,
    type: entry.type || inferType(path || address || id),
    bundle: normalizeRef(entry.bundle || 'default'),
    packageName: normalizeRef(entry.packageName || entry.package || ''),
    labels: unique(normalizeArray(entry.labels).map(normalizeRef)).sort(),
    tags: normalizeTags(entry.tags || entry.meta || {}),
    loaded: Boolean(entry.loaded),
    dependencies: normalizeReferenceList(entry.dependencies || entry.deps || entry.references),
    size: Number(entry.size || entry.bytes || 0),
    hash: entry.hash || entry.contentHash || null
  };
}

function buildIndices(assets) {
  const indices = {
    byUid: new Map(),
    byPrimaryId: new Map(),
    byAddress: new Map(),
    byPath: new Map(),
    byId: new Map(),
    byKey: new Map()
  };
  for (const asset of assets) {
    addIndex(indices.byUid, asset.uid, asset);
    addIndex(indices.byPrimaryId, asset.primaryId, asset);
    addIndex(indices.byAddress, asset.address, asset);
    addIndex(indices.byPath, asset.path, asset);
    addIndex(indices.byId, asset.id, asset);
    addIndex(indices.byKey, asset.key, asset);
  }
  return indices;
}

function addIndex(index, key, asset) {
  if (!key) return;
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(asset);
}

function normalizeReferenceList(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return unique(value.flatMap(normalizeReferenceList));
  if (typeof value === 'object') return unique(Object.values(value).flatMap(normalizeReferenceList));
  const normalized = normalizeRef(value);
  return normalized ? [normalized] : [];
}

function normalizeTags(tags = {}) {
  return Object.fromEntries(
    Object.entries(tags || {}).map(([key, value]) => [normalizeRef(key), normalizeRef(value)])
  );
}

function normalizeType(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePath(value) {
  return String(value || '').trim().replace(/\\/gu, '/').replace(/^\/+/u, '');
}

function normalizeRef(value) {
  return normalizePath(value);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function inferType(value) {
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(value)) return 'Texture';
  if (/\.(mp3|ogg|wav|m4a|webm)$/iu.test(value)) return 'Audio';
  if (/\.(glb|gltf|blend|fbx|obj)$/iu.test(value)) return 'Model';
  if (/\.(json|csv|tmx|atlas)$/iu.test(value)) return 'Data';
  if (/\.(prefab)$/iu.test(value)) return 'Prefab';
  if (/\.(scene)$/iu.test(value)) return 'Scene';
  return 'Asset';
}

function unique(values = []) {
  return [...new Set(values.filter((value) => value != null && value !== '').map(String))];
}

function uniqueCycleList(cycles) {
  const seen = new Set();
  const result = [];
  for (const cycle of cycles) {
    const key = cycle.join('>');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cycle);
  }
  return result;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default AssetRegistry;
