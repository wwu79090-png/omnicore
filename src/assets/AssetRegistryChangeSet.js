/**
 * Dependency-aware asset change session for editor file watches, imports, hot reload, and resource browser updates.
 */
export const ASSET_REGISTRY_CHANGE_PLAN_SCHEMA = 'omnicore.asset-registry-change-plan.v1';

export class AssetRegistryChangeSet {
  constructor({ registry, source = 'asset-change-session', changes = [] } = {}) {
    this.registry = registry;
    this.source = String(source || 'asset-change-session');
    this.changes = [];
    changes.forEach((change) => this.record(change));
  }

  static create(config = {}) {
    return new AssetRegistryChangeSet(config);
  }

  static crossEngineProfile() {
    return {
      sources: [
        'Unity AssetPostprocessor',
        'Unreal Asset Registry',
        'Godot EditorFileSystem',
        'Cocos Creator AssetDB'
      ],
      capabilities: [
        'asset-import-finished-session',
        'filesystem-change-signal',
        'dependency-aware-refresh',
        'reverse-reference-invalidation',
        'rename-repair-actions',
        'editor-browser-events'
      ]
    };
  }

  crossEngineProfile() {
    return AssetRegistryChangeSet.crossEngineProfile();
  }

  record(change = {}) {
    const normalized = normalizeChange(change, this.registry);
    this.changes.push(normalized);
    return normalized;
  }

  clear() {
    this.changes = [];
  }

  plan() {
    const directAssets = new Set();
    const affectedAssets = new Set();
    const directRuntimeActions = [];
    const dependencyRuntimeActions = [];
    const repairActions = [];
    const brokenReferences = [];
    const editorEvents = [];

    for (const change of this.changes) {
      if (change.asset) directAssets.add(change.asset);
      editorEvents.push(toEditorEvent(change));
      const directAction = toRuntimeAction(change);
      if (directAction) directRuntimeActions.push(directAction);

      if (change.kind === 'modified') {
        const affected = this._referencers(change.asset, { recursive: true });
        for (const edge of affected) {
          affectedAssets.add(edge.asset);
          dependencyRuntimeActions.push({
            type: 'refreshAsset',
            asset: edge.asset,
            reason: `depends-on:${change.asset}`
          });
        }
      }

      if (change.kind === 'moved') {
        const movePlan = this.registry?.planMove?.(change.asset, change.to) || null;
        for (const action of movePlan?.rewriteActions || []) repairActions.push(action);
        const affected = this._referencers(change.asset, { recursive: false });
        for (const edge of affected) {
          affectedAssets.add(edge.asset);
          dependencyRuntimeActions.push({
            type: 'refreshAsset',
            asset: edge.asset,
            reason: `depends-on:${change.asset}`
          });
        }
      }

      if (change.kind === 'deleted') {
        const affected = this._referencers(change.asset, { recursive: true });
        for (const edge of affected) {
          brokenReferences.push({
            source: edge.asset,
            missingAsset: change.asset,
            reason: 'deleted'
          });
        }
      }
    }

    const dedupedRuntimeActions = dedupeObjects([...directRuntimeActions, ...dependencyRuntimeActions]);
    const dedupedRepairActions = dedupeObjects(repairActions);
    const dedupedBrokenReferences = dedupeObjects(brokenReferences);
    const dedupedEditorEvents = dedupeObjects(editorEvents);
    const affected = [...affectedAssets].sort();

    return {
      schema: ASSET_REGISTRY_CHANGE_PLAN_SCHEMA,
      summary: {
        source: this.source,
        changeCount: this.changes.length,
        directAssetCount: directAssets.size,
        affectedAssetCount: affected.length,
        runtimeActionCount: dedupedRuntimeActions.length,
        repairActionCount: dedupedRepairActions.length,
        brokenReferenceCount: dedupedBrokenReferences.length,
        requiresSceneRefresh: affected.some((asset) => this._assetType(asset) === 'Scene')
      },
      directAssets: [...directAssets].sort(),
      affectedAssets: affected,
      runtimeActions: dedupedRuntimeActions,
      repairActions: dedupedRepairActions,
      brokenReferences: dedupedBrokenReferences,
      editorEvents: dedupedEditorEvents,
      crossEngineProfile: this.crossEngineProfile()
    };
  }

  _referencers(asset, options) {
    if (!asset || !this.registry?.getReferencers) return [];
    return this.registry.getReferencers(asset, options);
  }

  _assetType(asset) {
    return this.registry?.resolve?.(asset)?.type || null;
  }
}

function normalizeChange(change, registry) {
  const kind = normalizeKind(change.kind || change.type || 'modified');
  const asset = resolveAssetKey(change, registry);
  return {
    kind,
    asset,
    reference: normalizeRef(change.reference || change.asset?.address || change.asset?.primaryId || change.asset?.uid || asset),
    from: change.from ? normalizePath(change.from) : null,
    to: change.to ? normalizePath(change.to) : null,
    rawAsset: change.asset ? clone(change.asset) : null
  };
}

function resolveAssetKey(change, registry) {
  if (change.asset && typeof change.asset === 'object') return assetKey(change.asset);
  const reference = change.reference || change.asset || change.path || change.from || change.to;
  const resolved = registry?.resolve?.(reference);
  return resolved ? assetKey(resolved) : normalizeRef(reference);
}

function toRuntimeAction(change) {
  if (!change.asset) return null;
  if (change.kind === 'modified') {
    return {
      type: 'reloadAsset',
      asset: change.asset,
      reason: 'modified'
    };
  }
  if (change.kind === 'moved') {
    return {
      type: 'reloadAsset',
      asset: change.asset,
      reason: 'moved'
    };
  }
  if (change.kind === 'deleted') {
    return {
      type: 'unloadAsset',
      asset: change.asset,
      reason: 'deleted'
    };
  }
  if (change.kind === 'imported') {
    return {
      type: 'preloadAsset',
      asset: change.asset,
      reason: 'imported'
    };
  }
  return null;
}

function toEditorEvent(change) {
  if (change.kind === 'moved') {
    return {
      type: 'asset:moved',
      asset: change.asset,
      from: change.from,
      to: change.to
    };
  }
  if (change.kind === 'deleted') {
    return {
      type: 'asset:deleted',
      asset: change.asset
    };
  }
  if (change.kind === 'imported') {
    return {
      type: 'asset:imported',
      asset: change.asset
    };
  }
  return {
    type: 'asset:changed',
    asset: change.asset,
    kind: change.kind
  };
}

function normalizeKind(kind) {
  const normalized = String(kind || 'modified').toLowerCase();
  if (['changed', 'updated', 'reimported'].includes(normalized)) return 'modified';
  if (['added', 'created'].includes(normalized)) return 'imported';
  if (['removed', 'missing'].includes(normalized)) return 'deleted';
  if (['renamed'].includes(normalized)) return 'moved';
  return normalized;
}

function assetKey(asset = {}) {
  return normalizeRef(asset.address || asset.primaryId || asset.primaryAssetId || asset.path || asset.uid || asset.id || asset.key);
}

function normalizePath(value) {
  return String(value || '').trim().replace(/\\/gu, '/').replace(/^\/+/u, '');
}

function normalizeRef(value) {
  return normalizePath(value);
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

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default AssetRegistryChangeSet;
