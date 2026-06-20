import { createOmniError } from './OmniError.js';

export const API_TIERS = Object.freeze({
  public: 'public',
  experimental: 'experimental',
  internal: 'internal'
});

export const DEFAULT_API_SURFACE = Object.freeze({
  public: [
    'Game',
    'Scene',
    'Sprite',
    'Store',
    'Loader',
    'AssetLoader',
    'EventBus',
    'InputManager',
    'AudioManager',
    'Storage',
    'Backend',
    'RendererManager',
    'Tilemap',
    'Prefab',
    'Database',
    'createGame',
    'createLeanRuntime'
  ],
  experimental: [
    'WebGPURenderer',
    'RenderWorkerBridge',
    'Kernel',
    'EditorPanel',
    'RuntimeLiveSyncBridge',
    'AIImporter',
    'MarketplaceServer',
    'Dimension3D'
  ],
  internal: [
    'safeInitialize',
    'Bootstrap',
    'Assert',
    'DebugRenderer'
  ]
});

export class ApiSurface {
  constructor({ tiers = DEFAULT_API_SURFACE, namespace = null } = {}) {
    this.tiers = normalizeTiers(tiers);
    this.namespace = namespace;
  }

  classify(name) {
    const key = String(name || '');
    for (const tier of Object.values(API_TIERS)) {
      if (this.tiers[tier].includes(key)) return tier;
    }
    if (key.startsWith('_') || key.startsWith('internal')) return API_TIERS.internal;
    return API_TIERS.experimental;
  }

  snapshot(namespace = this.namespace) {
    const exported = namespace ? Object.keys(namespace).sort() : uniqueValues(this.tiers);
    const entries = exported.map((name) => ({
      name,
      tier: this.classify(name)
    }));
    return {
      schema: 'omnicore.api-surface.v1',
      tiers: {
        public: entries.filter((entry) => entry.tier === API_TIERS.public).map((entry) => entry.name),
        experimental: entries.filter((entry) => entry.tier === API_TIERS.experimental).map((entry) => entry.name),
        internal: entries.filter((entry) => entry.tier === API_TIERS.internal).map((entry) => entry.name)
      },
      entries
    };
  }

  diff(previous, next = this.snapshot()) {
    return diffApiSurface(previous, next);
  }

  assertNoBreakingChanges(previous, next = this.snapshot(), options = {}) {
    return assertNoBreakingApiChanges(previous, next, options);
  }
}

export function buildApiSurface(namespace = {}, tiers = DEFAULT_API_SURFACE) {
  return new ApiSurface({ namespace, tiers }).snapshot(namespace);
}

export function diffApiSurface(previous = {}, next = {}) {
  const before = normalizeSnapshot(previous);
  const after = normalizeSnapshot(next);
  const beforePublic = new Set(before.tiers.public);
  const afterPublic = new Set(after.tiers.public);
  const afterNames = new Set(after.entries.map((entry) => entry.name));
  const beforeByName = new Map(before.entries.map((entry) => [entry.name, entry]));
  const afterByName = new Map(after.entries.map((entry) => [entry.name, entry]));
  const removedPublic = [...beforePublic].filter((name) => !afterNames.has(name)).sort();
  const addedPublic = [...afterPublic].filter((name) => !beforePublic.has(name)).sort();
  const tierChanges = [];

  for (const [name, beforeEntry] of beforeByName) {
    const afterEntry = afterByName.get(name);
    if (afterEntry && afterEntry.tier !== beforeEntry.tier) {
      tierChanges.push({
        name,
        from: beforeEntry.tier,
        to: afterEntry.tier,
        breaking: beforeEntry.tier === API_TIERS.public && afterEntry.tier !== API_TIERS.public
      });
    }
  }

  return {
    removedPublic,
    addedPublic,
    tierChanges,
    breaking: removedPublic.length > 0 || tierChanges.some((item) => item.breaking)
  };
}

export function assertNoBreakingApiChanges(previous = {}, next = {}, {
  allowBreaking = false,
  migrationNote = ''
} = {}) {
  const diff = diffApiSurface(previous, next);
  if (!diff.breaking || allowBreaking) return diff;
  if (migrationNote) return diff;
  throw createOmniError('ApiSurface', '检测到破坏性 public API 变更，但缺少迁移说明。', {
    code: 'OMNICORE_API_BREAKING_CHANGE',
    category: 'api',
    recoverable: false,
    details: diff
  });
}

function normalizeTiers(tiers = {}) {
  return {
    public: normalizeList(tiers.public),
    experimental: normalizeList(tiers.experimental),
    internal: normalizeList(tiers.internal)
  };
}

function normalizeSnapshot(snapshot = {}) {
  const tiers = normalizeTiers(snapshot.tiers || snapshot);
  const names = uniqueValues(tiers);
  const entries = Array.isArray(snapshot.entries)
    ? snapshot.entries.map((entry) => ({ name: String(entry.name), tier: entry.tier || API_TIERS.experimental }))
    : names.map((name) => ({
      name,
      tier: tiers.public.includes(name)
        ? API_TIERS.public
        : tiers.internal.includes(name)
          ? API_TIERS.internal
          : API_TIERS.experimental
    }));
  return {
    schema: snapshot.schema || 'omnicore.api-surface.v1',
    tiers,
    entries
  };
}

function normalizeList(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item)).filter(Boolean))].sort();
}

function uniqueValues(tiers = {}) {
  return [...new Set([
    ...normalizeList(tiers.public),
    ...normalizeList(tiers.experimental),
    ...normalizeList(tiers.internal)
  ])].sort();
}

export default ApiSurface;
