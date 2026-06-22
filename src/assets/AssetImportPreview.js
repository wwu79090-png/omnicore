export const ASSET_IMPORT_PREVIEW_SCHEMA = 'omnicore.asset-import-preview.v1';

export class AssetImportPreview {
  constructor({ profile, current = [] } = {}) {
    this.profile = profile;
    this.current = new Map(normalizeArray(current).map((asset) => [normalizePath(asset.source), clone(asset)]));
  }

  static create(config = {}) {
    return new AssetImportPreview(config);
  }

  static crossEngineProfile() {
    return {
      sources: [
        'Unreal Interchange import preview',
        'Godot advanced import preview',
        'Unity AssetDatabase refresh loop safeguards',
        'Cocos Creator texture compression preset exchange'
      ],
      capabilities: [
        'import-preview',
        'dry-run-reimport-plan',
        'output-collision-detection',
        'protected-edit-conflict-warning',
        'unchanged-import-skip',
        'reimport-loop-guard'
      ]
    };
  }

  crossEngineProfile() {
    return AssetImportPreview.crossEngineProfile();
  }

  preview(assets = [], options = {}) {
    const entries = normalizeArray(assets)
      .map((asset) => this._entryFor(asset, options))
      .sort((left, right) => left.source.localeCompare(right.source));
    const diagnostics = [
      ...outputCollisionDiagnostics(entries),
      ...entries.flatMap((entry) => entry.diagnostics)
    ];
    const steps = entries.map((entry) => stepForEntry(entry));
    const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
    const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;

    return {
      schema: ASSET_IMPORT_PREVIEW_SCHEMA,
      summary: {
        ok: errorCount === 0,
        assetCount: entries.length,
        createCount: entries.filter((entry) => entry.action === 'create').length,
        updateCount: entries.filter((entry) => entry.action === 'update').length,
        unchangedCount: entries.filter((entry) => entry.action === 'unchanged').length,
        conflictCount: diagnostics.length,
        errorCount,
        warningCount
      },
      entries,
      diagnostics,
      steps,
      crossEngineProfile: this.crossEngineProfile()
    };
  }

  _entryFor(asset, options) {
    const resolution = this.profile.resolve(asset, options);
    const current = this.current.get(resolution.source) || null;
    const action = actionForResolution(resolution, current);
    const reasons = reasonsForAction(action, resolution, current);
    const diagnostics = entryDiagnostics({
      sourceRoot: this.profile.sourceRoot,
      resolution,
      current,
      action
    });

    return {
      source: resolution.source,
      importer: resolution.importer,
      preset: resolution.preset,
      platform: resolution.platform,
      action,
      reasons,
      output: clone(resolution.output),
      settings: clone(resolution.settings),
      reimport: clone(resolution.reimport),
      current: current ? clone(current) : null,
      diagnostics
    };
  }
}

function actionForResolution(resolution, current) {
  if (!current) return 'create';
  if (current.reimport?.cacheKey === resolution.reimport.cacheKey) return 'unchanged';
  return 'update';
}

function reasonsForAction(action, resolution, current) {
  if (action === 'create') return ['new-source'];
  if (action === 'unchanged') return [];
  const reasons = [];
  if (current?.reimport?.cacheKey !== resolution.reimport.cacheKey) reasons.push('cache-key-changed');
  return reasons;
}

function entryDiagnostics({ sourceRoot, resolution, current, action }) {
  const diagnostics = [];
  if (outputWritesInsideSourceRoot(resolution.output.path, sourceRoot)) {
    diagnostics.push({
      code: 'reimport-loop-risk',
      severity: 'error',
      source: resolution.source,
      output: resolution.output.path,
      sourceRoot
    });
  }
  const protectedEdits = normalizeArray(current?.protectedEdits);
  if (action === 'update' && protectedEdits.length > 0) {
    diagnostics.push({
      code: 'protected-reimport-overwrite',
      severity: 'warning',
      source: resolution.source,
      protectedEdits
    });
  }
  return diagnostics;
}

function outputCollisionDiagnostics(entries) {
  const byPath = new Map();
  for (const entry of entries) {
    const outputPath = normalizePath(entry.output.path);
    if (!byPath.has(outputPath)) byPath.set(outputPath, []);
    byPath.get(outputPath).push(entry.source);
  }
  return [...byPath.entries()]
    .filter(([, sources]) => sources.length > 1)
    .map(([path, sources]) => ({
      code: 'output-path-collision',
      severity: 'error',
      path,
      sources: [...sources].sort()
    }));
}

function stepForEntry(entry) {
  const blocking = entry.diagnostics.find((diagnostic) => diagnostic.code === 'reimport-loop-risk')
    || entry.diagnostics.find((diagnostic) => diagnostic.code === 'protected-reimport-overwrite');
  if (blocking) {
    return {
      type: 'blocked',
      source: entry.source,
      reason: blocking.code
    };
  }
  if (entry.action === 'unchanged') {
    return {
      type: 'skip',
      source: entry.source,
      reason: 'unchanged'
    };
  }
  return {
    type: 'import',
    action: entry.action,
    source: entry.source,
    output: entry.output.path
  };
}

function outputWritesInsideSourceRoot(outputPath, sourceRoot) {
  const output = normalizePath(outputPath);
  const root = normalizePath(sourceRoot).replace(/\/$/u, '');
  return output === root || output.startsWith(`${root}/`);
}

function normalizePath(value) {
  return String(value || '').replace(/\\/gu, '/').replace(/\/+/gu, '/').toLowerCase();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

export default AssetImportPreview;
