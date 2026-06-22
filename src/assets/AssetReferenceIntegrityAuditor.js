/**
 * Resource database auditor for stable ids, addressable paths, bundle dependencies, and prefab/scene repair plans.
 */
export const ASSET_REFERENCE_INTEGRITY_REPORT_SCHEMA = 'omnicore.asset-reference-integrity-report.v1';

export class AssetReferenceIntegrityAuditor {
  constructor({
    catalog = null,
    assets = [],
    entries = [],
    scenes = [],
    prefabs = [],
    startupBundles = []
  } = {}) {
    const catalogEntries = Array.isArray(catalog?.entries) ? catalog.entries : [];
    this.assets = [...catalogEntries, ...assets, ...entries].map(normalizeAssetEntry);
    this.scenes = normalizeSources(scenes, 'scene');
    this.prefabs = normalizeSources(prefabs, 'prefab');
    this.startupBundles = unique(startupBundles.map(normalizeRef));
    this.index = buildAssetIndex(this.assets);
  }

  static create(config = {}) {
    return new AssetReferenceIntegrityAuditor(config);
  }

  static crossEngineProfile() {
    return {
      sources: [
        'Unity Addressables',
        'Godot ResourceUID',
        'Cocos Creator Asset Bundle',
        'Unreal Asset Manager'
      ],
      capabilities: [
        'stable-resource-uids',
        'addressable-resolution',
        'primary-asset-ids',
        'bundle-dependency-audit',
        'prefab-scene-reference-repair',
        'cook-readiness-report'
      ]
    };
  }

  crossEngineProfile() {
    return AssetReferenceIntegrityAuditor.crossEngineProfile();
  }

  resolve(reference) {
    return clone(this._resolveDetailed(reference).asset);
  }

  audit(options = {}) {
    const renamed = normalizeRenameMap(options.renamed || options.renames || {});
    const startupBundles = unique([...this.startupBundles, ...normalizeArray(options.startupBundles).map(normalizeRef)]);
    const references = [];
    const issues = [];
    const repairActions = [];
    const referencedAssets = new Map();

    for (const source of [...this.scenes, ...this.prefabs]) {
      for (const reference of source.references) {
        const resolution = this._resolveDetailed(reference, { renamed });
        const referenceReport = {
          source: source.id,
          sourceType: source.type,
          reference,
          resolved: Boolean(resolution.asset),
          resolvedBy: resolution.resolvedBy,
          asset: resolution.asset ? assetKey(resolution.asset) : null
        };
        references.push(referenceReport);

        if (!resolution.asset) {
          issues.push({
            code: 'missing-reference',
            source: source.id,
            sourceType: source.type,
            reference,
            severity: 'error',
            message: `${source.id} references missing asset ${reference}.`
          });
          repairActions.push({
            type: 'createPlaceholderAsset',
            source: source.id,
            reference
          });
          continue;
        }

        const key = assetKey(resolution.asset);
        referencedAssets.set(key, resolution.asset);
        if (resolution.resolvedBy === 'renamed-path') {
          issues.push({
            code: 'stale-path',
            source: source.id,
            sourceType: source.type,
            reference,
            asset: key,
            replacement: resolution.replacement,
            severity: 'warning',
            message: `${source.id} still points at moved asset ${reference}.`
          });
          repairActions.push({
            type: 'rewriteReference',
            source: source.id,
            from: reference,
            to: resolution.replacement,
            via: 'renamed-path'
          });
        }
      }
    }

    for (const asset of referencedAssets.values()) {
      if (!asset.address) {
        issues.push({
          code: 'missing-address',
          asset: assetKey(asset),
          severity: 'warning',
          message: `Asset ${assetKey(asset)} is referenced but has no addressable id.`
        });
        repairActions.push({
          type: 'markAddressable',
          asset: assetKey(asset),
          suggestedAddress: suggestAddress(asset)
        });
      }
      if (!asset.primaryId) {
        issues.push({
          code: 'missing-primary-asset-id',
          asset: assetKey(asset),
          severity: 'warning',
          message: `Asset ${assetKey(asset)} is referenced but has no primary asset id.`
        });
        repairActions.push({
          type: 'promotePrimaryAsset',
          asset: assetKey(asset),
          suggestedPrimaryId: suggestPrimaryAssetId(asset)
        });
      }
    }

    const bundleGraph = this._buildBundleGraph();
    for (const dependency of bundleGraph.crossBundleDependencies) {
      issues.push({
        code: 'cross-bundle-dependency',
        asset: dependency.dependency,
        source: dependency.source,
        severity: 'warning',
        message: `${dependency.source} in ${dependency.sourceBundle} depends on ${dependency.dependency} in ${dependency.dependencyBundle}.`
      });
      repairActions.push({
        type: 'moveToSharedBundle',
        asset: dependency.dependency,
        fromBundle: dependency.dependencyBundle,
        toBundle: 'shared',
        reason: `referenced-by-${dependency.sourceBundle}`
      });
    }

    const repairPlan = {
      actions: dedupeActions(repairActions)
    };
    const cookReadiness = buildCookReadiness({
      assets: this.assets,
      issues,
      startupBundles
    });

    return {
      schema: ASSET_REFERENCE_INTEGRITY_REPORT_SCHEMA,
      summary: {
        assetCount: this.assets.length,
        sceneCount: this.scenes.length,
        prefabCount: this.prefabs.length,
        issueCount: issues.length,
        repairActionCount: repairPlan.actions.length,
        ready: issues.length === 0
      },
      references,
      issues,
      bundleGraph,
      cookReadiness,
      repairPlan,
      crossEngineProfile: this.crossEngineProfile()
    };
  }

  _resolveDetailed(reference, { renamed = {} } = {}) {
    const key = normalizeRef(reference);
    const direct = findIndexedAsset(this.index, key);
    if (direct) return { asset: direct.asset, resolvedBy: direct.resolvedBy, replacement: null };

    const replacement = renamed[key] || renamed[normalizePath(key)] || null;
    if (replacement) {
      const moved = findIndexedAsset(this.index, normalizeRef(replacement));
      if (moved) return { asset: moved.asset, resolvedBy: 'renamed-path', replacement: normalizeRef(replacement) };
    }

    return { asset: null, resolvedBy: null, replacement: null };
  }

  _buildBundleGraph() {
    const bundles = {};
    const crossBundleDependencies = [];

    for (const asset of this.assets) {
      const bundle = asset.bundle || 'default';
      if (!bundles[bundle]) bundles[bundle] = { assets: [], dependencies: [] };
      bundles[bundle].assets.push(assetKey(asset));

      for (const dependencyRef of asset.dependencies) {
        const dependency = this._resolveDetailed(dependencyRef).asset;
        if (!dependency) {
          bundles[bundle].dependencies.push(dependencyRef);
          continue;
        }
        const dependencyKey = assetKey(dependency);
        bundles[bundle].dependencies.push(dependencyKey);
        if (dependency.bundle && dependency.bundle !== bundle && dependency.bundle !== 'shared') {
          crossBundleDependencies.push({
            source: assetKey(asset),
            sourceBundle: bundle,
            dependency: dependencyKey,
            dependencyBundle: dependency.bundle
          });
        }
      }
    }

    return {
      bundles: Object.fromEntries(
        Object.entries(bundles).map(([bundle, info]) => [
          bundle,
          {
            assets: unique(info.assets).sort(),
            dependencies: unique(info.dependencies).sort()
          }
        ]).sort(([left], [right]) => left.localeCompare(right))
      ),
      crossBundleDependencies
    };
  }
}

function buildCookReadiness({ assets, issues, startupBundles }) {
  return {
    ready: issues.length === 0,
    startupBundles: [...startupBundles].sort(),
    preloadAssets: assets
      .filter((asset) => startupBundles.includes(asset.bundle) || asset.labels.includes('startup'))
      .map(assetKey)
      .sort(),
    missingAddressableAssets: issueAssets(issues, 'missing-address'),
    missingPrimaryAssets: issueAssets(issues, 'missing-primary-asset-id'),
    missingReferences: issueRefs(issues, 'missing-reference'),
    staleReferences: issueRefs(issues, 'stale-path')
  };
}

function issueAssets(issues, code) {
  return unique(issues.filter((issue) => issue.code === code).map((issue) => issue.asset)).sort();
}

function issueRefs(issues, code) {
  return unique(issues.filter((issue) => issue.code === code).map((issue) => issue.reference)).sort();
}

function normalizeAssetEntry(entry = {}) {
  const address = entry.address ? normalizeRef(entry.address) : null;
  const path = normalizePath(entry.path || entry.url || entry.src || '');
  const uid = entry.uid ? normalizeRef(entry.uid) : null;
  const primaryId = entry.primaryId || entry.primaryAssetId ? normalizeRef(entry.primaryId || entry.primaryAssetId) : null;
  const id = normalizeRef(entry.id || entry.key || address || primaryId || uid || path);
  return {
    id,
    uid,
    primaryId,
    address,
    path,
    bundle: normalizeRef(entry.bundle || 'default'),
    type: entry.type || inferType(path || address || id),
    labels: unique(normalizeArray(entry.labels).map(normalizeRef)).sort(),
    dependencies: normalizeReferenceList(entry.dependencies || entry.deps || entry.references),
    hash: entry.hash || entry.contentHash || null,
    meta: clone(entry.meta || {})
  };
}

function normalizeSources(sources, type) {
  return normalizeArray(sources).map((source, index) => {
    const value = typeof source === 'string' ? { id: source } : source || {};
    return {
      id: normalizeRef(value.id || value.name || `${type}-${index}`),
      type,
      references: unique([
        ...normalizeReferenceList(value.assets || value.assetRefs),
        ...normalizeReferenceList(value.dependencies),
        ...normalizeReferenceList(value.references)
      ])
    };
  });
}

function normalizeReferenceList(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeReferenceList);
  if (typeof value === 'object') return Object.values(value).flatMap(normalizeReferenceList);
  const normalized = normalizeRef(value);
  return normalized ? [normalized] : [];
}

function buildAssetIndex(assets) {
  const index = {
    byUid: new Map(),
    byPrimaryId: new Map(),
    byAddress: new Map(),
    byPath: new Map(),
    byId: new Map()
  };
  for (const asset of assets) {
    setIndex(index.byUid, asset.uid, asset);
    setIndex(index.byPrimaryId, asset.primaryId, asset);
    setIndex(index.byAddress, asset.address, asset);
    setIndex(index.byPath, asset.path, asset);
    setIndex(index.byId, asset.id, asset);
  }
  return index;
}

function setIndex(map, key, asset) {
  if (!key || map.has(key)) return;
  map.set(key, asset);
}

function findIndexedAsset(index, key) {
  const lookups = [
    ['uid', index.byUid],
    ['primaryId', index.byPrimaryId],
    ['address', index.byAddress],
    ['path', index.byPath],
    ['id', index.byId]
  ];
  for (const [resolvedBy, map] of lookups) {
    const asset = map.get(key);
    if (asset) return { asset, resolvedBy };
  }
  return null;
}

function normalizeRenameMap(renamed) {
  return Object.fromEntries(
    Object.entries(renamed || {}).map(([from, to]) => [normalizeRef(from), normalizeRef(to)])
  );
}

function dedupeActions(actions) {
  const seen = new Set();
  const result = [];
  for (const action of actions) {
    const key = JSON.stringify(action);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result;
}

function assetKey(asset) {
  return asset.address || asset.primaryId || asset.path || asset.uid || asset.id;
}

function suggestAddress(asset) {
  return toIdentifier(fileStem(asset.path || asset.id || asset.uid || 'asset'));
}

function suggestPrimaryAssetId(asset) {
  const type = toPascalCase(inferType(asset.path || asset.address || asset.id));
  return `${type}:${toPascalCase(fileStem(asset.path || asset.id || asset.uid || 'Asset'))}`;
}

function inferType(value) {
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(value)) return 'Texture';
  if (/\.(mp3|ogg|wav|m4a|webm)$/iu.test(value)) return 'Audio';
  if (/\.(glb|gltf|blend|fbx|obj)$/iu.test(value)) return 'Model';
  if (/\.(json|csv|tmx|atlas)$/iu.test(value)) return 'Data';
  if (/\.(fnt|ttf|otf|woff2?)$/iu.test(value)) return 'Font';
  return 'Asset';
}

function fileStem(value) {
  const path = normalizePath(value);
  const file = path.split('/').filter(Boolean).pop() || path || 'asset';
  return file.replace(/\.[^.]+$/u, '');
}

function toIdentifier(value) {
  return String(value || 'asset')
    .replace(/[^a-zA-Z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase() || 'asset';
}

function toPascalCase(value) {
  const words = String(value || 'Asset').match(/[a-zA-Z0-9]+/gu) || ['Asset'];
  return words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join('');
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

function unique(values = []) {
  return [...new Set(values.filter((value) => value != null && value !== '').map(String))];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default AssetReferenceIntegrityAuditor;
