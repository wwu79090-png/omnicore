export const ASSET_DEPENDENCY_TRACKER_REPORT_SCHEMA = 'omnicore.asset-dependency-tracker-report.v1';

export class AssetDependencyTracker {
  constructor({
    registry = null,
    imports = [],
    knownInputs = [],
    bundlePriorities = {}
  } = {}) {
    this.registry = registry;
    this.imports = normalizeArray(imports).map(normalizeImportRecord);
    this.knownInputs = new Set([
      ...normalizeArray(knownInputs).map(normalizePath),
      ...this.imports.map((record) => record.source).filter(Boolean)
    ]);
    this.bundlePriorities = normalizePriorityMap(bundlePriorities);
  }

  static create(config = {}) {
    return new AssetDependencyTracker(config);
  }

  static crossEngineProfile() {
    return {
      sources: [
        'Unity AssetDatabase static and dynamic dependencies',
        'Unreal Asset Registry dependency queries',
        'Godot ResourceLoader dependency listing',
        'Cocos Creator Asset Bundle dependency priority',
        'PixiJS texture cache invalidation'
      ],
      capabilities: [
        'static-dynamic-dependency-tracking',
        'stale-import-detection',
        'topological-reimport-queue',
        'runtime-invalidation-plan',
        'missing-source-dependency-audit',
        'bundle-shared-dependency-awareness'
      ]
    };
  }

  crossEngineProfile() {
    return AssetDependencyTracker.crossEngineProfile();
  }

  analyze(changes = [], {
    importerVersions = {},
    platform = null,
    entrypoints = []
  } = {}) {
    const changedInputs = normalizeChanges(changes);
    const changedInputSet = new Set(changedInputs.map((change) => change.path));
    const deletedInputSet = new Set(changedInputs.filter((change) => change.deleted).map((change) => change.path));
    const expectedImporterVersions = normalizeVersionMap(importerVersions);
    const expectedPlatform = platform ? normalizeToken(platform) : null;
    const missingDependencies = this._missingDependencies(deletedInputSet);
    const staleByAsset = this._directStaleImports({
      changedInputSet,
      expectedImporterVersions,
      expectedPlatform
    });
    const staleImports = this._cascadeRegistryStaleness(staleByAsset);
    const cycles = detectStaleCycles(staleImports);
    const reimportQueue = orderReimports(staleImports, cycles);
    const runtimeInvalidations = this._runtimeInvalidations(reimportQueue);
    const bundleSharedDependencies = this._bundleSharedDependencies();
    const registryAudit = this._registryAudit(entrypoints);
    const ready = missingDependencies.length === 0 && cycles.length === 0;

    return {
      schema: ASSET_DEPENDENCY_TRACKER_REPORT_SCHEMA,
      ok: ready,
      summary: {
        importCount: this.imports.length,
        changedInputCount: changedInputs.length,
        staleImportCount: staleImports.length,
        missingDependencyCount: missingDependencies.length,
        runtimeInvalidationCount: runtimeInvalidations.length,
        reimportQueueCount: reimportQueue.length,
        sharedDependencyCount: bundleSharedDependencies.length,
        cycleCount: cycles.length,
        ready
      },
      changedInputs,
      staleImports,
      reimportQueue,
      runtimeInvalidations,
      missingDependencies,
      bundleSharedDependencies,
      cycles,
      registryAudit,
      crossEngineProfile: this.crossEngineProfile()
    };
  }

  _directStaleImports({
    changedInputSet,
    expectedImporterVersions,
    expectedPlatform
  }) {
    const staleByAsset = new Map();
    for (const record of this.imports) {
      const reasons = [];
      if (changedInputSet.has(record.source)) reasons.push(`source-changed:${record.source}`);
      for (const dependency of record.staticDependencies) {
        if (changedInputSet.has(dependency)) reasons.push(`static-dependency-changed:${dependency}`);
      }
      for (const dependency of record.dynamicDependencies) {
        if (changedInputSet.has(dependency)) reasons.push(`dynamic-dependency-changed:${dependency}`);
      }
      const expectedVersion = expectedImporterVersions[record.importer];
      if (expectedVersion && record.importerVersion && expectedVersion !== record.importerVersion) {
        reasons.push(`importer-version-changed:${record.importer}`);
      }
      if (expectedPlatform && record.platform && expectedPlatform !== record.platform) {
        reasons.push(`platform-changed:${expectedPlatform}`);
      }
      if (reasons.length > 0) staleByAsset.set(record.asset, createStaleImport(record, reasons));
    }
    return staleByAsset;
  }

  _cascadeRegistryStaleness(staleByAsset) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const record of this.imports) {
        if (staleByAsset.has(record.asset)) continue;
        const staleDependency = this._staleDependencyFor(record, staleByAsset);
        if (!staleDependency) continue;
        staleByAsset.set(record.asset, createStaleImport(record, [
          `registry-dependency-stale:${staleDependency}`
        ]));
        changed = true;
      }
    }
    return [...staleByAsset.values()].sort((left, right) => left.source.localeCompare(right.source));
  }

  _staleDependencyFor(record, staleByAsset) {
    const staleAssets = new Set(staleByAsset.keys());
    for (const dependency of dependencyAssetsFor(record, this.registry)) {
      if (staleAssets.has(dependency)) return dependency;
    }
    return null;
  }

  _runtimeInvalidations(reimportQueue) {
    const staleAssets = new Set(reimportQueue.map((entry) => entry.asset));
    const direct = reimportQueue.map((entry) => ({
      type: 'reloadAsset',
      asset: entry.asset,
      reason: 'stale-import'
    }));
    const dependentRefreshes = [];

    for (const entry of reimportQueue) {
      for (const edge of this._referencers(entry.asset)) {
        if (staleAssets.has(edge.asset)) continue;
        dependentRefreshes.push({
          type: 'refreshAsset',
          asset: edge.asset,
          reason: `depends-on:${entry.asset}`
        });
      }
    }

    return dedupeActions([...direct, ...dependentRefreshes]);
  }

  _missingDependencies(deletedInputSet) {
    const missing = [];
    for (const record of this.imports) {
      for (const dependency of record.staticDependencies) {
        if (!this._dependencyExists(dependency) || deletedInputSet.has(dependency)) {
          missing.push(missingDependency(record, dependency, 'static'));
        }
      }
      for (const dependency of record.dynamicDependencies) {
        if (!this._dependencyExists(dependency) || deletedInputSet.has(dependency)) {
          missing.push(missingDependency(record, dependency, 'dynamic'));
        }
      }
    }
    return dedupeObjects(missing);
  }

  _dependencyExists(dependency) {
    if (!dependency) return true;
    if (this.knownInputs.has(dependency)) return true;
    if (this.imports.some((record) => record.source === dependency || record.asset === dependency)) return true;
    return Boolean(this.registry?.resolve?.(dependency));
  }

  _bundleSharedDependencies() {
    const byDependency = new Map();
    for (const record of this.imports) {
      for (const dependency of [...record.staticDependencies, ...record.dynamicDependencies]) {
        if (!byDependency.has(dependency)) byDependency.set(dependency, []);
        byDependency.get(dependency).push(record);
      }
    }

    return [...byDependency.entries()]
      .map(([dependency, records]) => sharedDependencyFor(dependency, records, this.bundlePriorities))
      .filter(Boolean)
      .sort((left, right) => left.dependency.localeCompare(right.dependency));
  }

  _registryAudit(entrypoints) {
    if (!this.registry?.audit) return null;
    return this.registry.audit({ entrypoints });
  }

  _referencers(asset) {
    if (!asset || !this.registry?.getReferencers) return [];
    return this.registry.getReferencers(asset, { recursive: true });
  }
}

function normalizeImportRecord(record = {}) {
  const reimportInputs = record.reimport?.inputs || {};
  const source = normalizePath(record.source || record.path || record.src || reimportInputs.source || '');
  const asset = normalizeRef(
    record.asset
    || record.registryReference
    || record.address
    || record.primaryId
    || record.output?.path
    || source
  );
  const importer = normalizeToken(record.importer || reimportInputs.importer || inferImporter(source));
  const importerVersion = normalizeToken(record.importerVersion || reimportInputs.importerVersion || '');
  const platform = normalizeToken(record.platform || reimportInputs.platform || '');
  const staticDependencies = unique([
    ...normalizeArray(reimportInputs.dependencies),
    ...normalizeArray(record.staticDependencies),
    ...normalizeArray(record.dependencies)
  ].map(normalizeRef));
  const dynamicDependencies = unique([
    ...normalizeArray(reimportInputs.dynamicDependencies),
    ...normalizeArray(record.dynamicDependencies),
    ...normalizeArray(record.reimport?.dynamicDependencies),
    ...normalizeArray(record.metadata?.dynamicDependencies)
  ].map(normalizeRef));

  return {
    source,
    asset,
    importer,
    importerVersion,
    platform,
    bundle: normalizeRef(record.bundle || record.output?.bundle || 'default'),
    staticDependencies,
    dynamicDependencies
  };
}

function normalizeChanges(changes = []) {
  return normalizeArray(changes)
    .map((change) => {
      if (typeof change === 'string') {
        return {
          path: normalizePath(change),
          hash: null,
          deleted: false
        };
      }
      return {
        path: normalizePath(change.path || change.source || change.asset || ''),
        hash: change.hash || change.contentHash || null,
        deleted: Boolean(change.deleted || change.removed || change.kind === 'deleted')
      };
    })
    .filter((change) => change.path)
    .sort((left, right) => left.path.localeCompare(right.path));
}

function normalizeVersionMap(importerVersions = {}) {
  return Object.fromEntries(
    Object.entries(importerVersions || {}).map(([key, value]) => [normalizeToken(key), normalizeToken(value)])
  );
}

function normalizePriorityMap(bundlePriorities = {}) {
  return Object.fromEntries(
    Object.entries(bundlePriorities || {}).map(([key, value]) => [normalizeRef(key), Number(value || 0)])
  );
}

function createStaleImport(record, reasons) {
  return {
    source: record.source,
    asset: record.asset,
    importer: record.importer,
    bundle: record.bundle,
    dependencies: unique([...record.staticDependencies, ...record.dynamicDependencies]),
    reasons: unique(reasons)
  };
}

function orderReimports(staleImports, cycles) {
  const staleByAsset = new Map(staleImports.map((entry) => [entry.asset, entry]));
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];

  const visit = (entry) => {
    if (visited.has(entry.asset) || visiting.has(entry.asset)) return;
    visiting.add(entry.asset);
    for (const dependency of entry.dependencies || []) {
      const dependencyEntry = staleByAsset.get(dependency);
      if (dependencyEntry) visit(dependencyEntry);
    }
    visiting.delete(entry.asset);
    visited.add(entry.asset);
    ordered.push(entry);
  };

  const sortable = staleImports.map((entry) => ({
    ...entry,
    dependencies: dependencyAssetsFor(entry)
  }));
  const sortableByAsset = new Map(sortable.map((entry) => [entry.asset, entry]));
  for (const entry of sortable) {
    entry.dependencies = entry.dependencies.filter((dependency) => sortableByAsset.has(dependency));
  }
  for (const entry of sortable) visit(entry);

  const cycleAssets = new Set(cycles.flat());
  return ordered
    .sort((left, right) => {
      if (cycleAssets.has(left.asset) || cycleAssets.has(right.asset)) {
        return left.source.localeCompare(right.source);
      }
      return 0;
    })
    .map((entry, order) => stripInternalQueueFields({ ...entry, order }));
}

function dependencyAssetsFor(record, registry = null) {
  const fromRecord = [
    ...normalizeArray(record.staticDependencies),
    ...normalizeArray(record.dynamicDependencies),
    ...normalizeArray(record.dependencies)
  ]
    .map(normalizeRef);
  const fromRegistry = registry?.getDependencies?.(record.asset, { recursive: false })
    .map((edge) => edge.asset) || [];
  return unique([...fromRecord, ...fromRegistry]);
}

function detectStaleCycles(staleImports) {
  const staleAssets = new Set(staleImports.map((entry) => entry.asset));
  const cycles = [];
  for (const entry of staleImports) {
    const dependencies = dependencyAssetsFor(entry).filter((dependency) => staleAssets.has(dependency));
    for (const dependency of dependencies) {
      const dependencyEntry = staleImports.find((candidate) => candidate.asset === dependency);
      if (!dependencyEntry) continue;
      if (dependencyAssetsFor(dependencyEntry).includes(entry.asset)) {
        cycles.push([entry.asset, dependency]);
      }
    }
  }
  return uniqueCycleList(cycles);
}

function stripInternalQueueFields(entry) {
  const { dependencies, ...publicEntry } = entry;
  return publicEntry;
}

function missingDependency(record, dependency, dependencyType) {
  return {
    source: record.source,
    asset: record.asset,
    dependency,
    dependencyType,
    severity: 'error'
  };
}

function sharedDependencyFor(dependency, records, bundlePriorities) {
  const bundles = unique(records.map((record) => record.bundle)).sort();
  if (bundles.length <= 1) return null;
  const ownerBundle = bundles
    .slice()
    .sort((left, right) => (bundlePriorities[right] || 0) - (bundlePriorities[left] || 0) || left.localeCompare(right))[0];
  return {
    dependency,
    bundles,
    ownerBundle,
    consumers: records.map((record) => record.asset).sort()
  };
}

function dedupeActions(actions) {
  const seen = new Set();
  const result = [];
  for (const action of actions) {
    const key = `${action.type}:${action.asset}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result;
}

function dedupeObjects(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function uniqueCycleList(cycles) {
  const seen = new Set();
  const result = [];
  for (const cycle of cycles) {
    const sorted = [...cycle].sort();
    const key = sorted.join('>');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cycle);
  }
  return result;
}

function inferImporter(source) {
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(source)) return 'texture';
  if (/\.(mp3|ogg|wav|m4a)$/iu.test(source)) return 'audio';
  if (/\.(glb|gltf|fbx|obj|blend|usd|usdz)$/iu.test(source)) return 'model';
  if (/\.(json|csv|tmx|xml|yaml|yml)$/iu.test(source)) return 'data';
  if (/\.(ttf|otf|woff|woff2)$/iu.test(source)) return 'font';
  return 'asset';
}

function normalizePath(value) {
  return String(value || '')
    .trim()
    .replace(/\\/gu, '/')
    .replace(/\/+/gu, '/')
    .toLowerCase();
}

function normalizeRef(value) {
  return normalizePath(value).replace(/^\/+/u, '');
}

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function unique(values = []) {
  return [...new Set(values.filter((value) => value != null && value !== '').map(String))];
}

export default AssetDependencyTracker;
