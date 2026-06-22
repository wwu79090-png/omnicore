import { createOmniError } from '../core/OmniError.js';

export class AssetResidencyManager {
  constructor() {
    this.assets = new Map();
  }

  register(id, { sizeBytes = 0, dependencies = [] } = {}) {
    const key = String(id);
    this.assets.set(key, {
      id: key,
      sizeBytes: Math.max(0, Number(sizeBytes) || 0),
      dependencies: normalizeArray(dependencies).map(String),
      refs: 0,
      dependencyRefs: 0,
      resident: false,
      pinned: false,
      lastUsed: 0
    });
    return this;
  }

  load(id) {
    const asset = this._asset(id);
    asset.refs += 1;
    asset.resident = true;
    asset.lastUsed = Date.now();
    for (const dependency of asset.dependencies) {
      this.load(dependency);
      asset.dependencyRefs += 1;
    }
    return this;
  }

  release(id) {
    const asset = this._asset(id);
    if (asset.refs === 0) return this;
    asset.refs -= 1;
    if (asset.refs === 0) this._releaseDependencies(asset);
    return this;
  }

  pin(id) {
    const asset = this._asset(id);
    asset.pinned = true;
    asset.resident = true;
    return this;
  }

  unpin(id) {
    this._asset(id).pinned = false;
    return this;
  }

  unloadPlan({ maxBytes = 0 } = {}) {
    const target = Math.max(0, Number(maxBytes) || 0);
    let total = this._totalResidentBytes();
    const plan = [];
    const candidates = [...this.assets.values()]
      .filter((asset) => asset.resident && asset.refs === 0 && !asset.pinned)
      .sort((a, b) => b.sizeBytes - a.sizeBytes || a.lastUsed - b.lastUsed || a.id.localeCompare(b.id));

    for (const asset of candidates) {
      if (total <= target) break;
      if (plan.length > 0 && total - asset.sizeBytes < target) break;
      plan.push({ id: asset.id, sizeBytes: asset.sizeBytes });
      total -= asset.sizeBytes;
    }
    return plan;
  }

  flushUnloads(options = {}) {
    const unloaded = [];
    for (const entry of this.unloadPlan(options)) {
      this._asset(entry.id).resident = false;
      unloaded.push(entry.id);
    }
    return unloaded;
  }

  snapshot() {
    return {
      totalResidentBytes: this._totalResidentBytes(),
      assets: Object.fromEntries([...this.assets.values()].sort((a, b) => a.id.localeCompare(b.id)).map((asset) => [
        asset.id,
        {
          refs: asset.refs,
          resident: asset.resident,
          pinned: asset.pinned,
          sizeBytes: asset.sizeBytes,
          dependencies: [...asset.dependencies]
        }
      ]))
    };
  }

  _totalResidentBytes() {
    return [...this.assets.values()]
      .filter((asset) => asset.resident)
      .reduce((sum, asset) => sum + asset.sizeBytes, 0);
  }

  _asset(id) {
    const asset = this.assets.get(String(id));
    if (!asset) throw createOmniError('AssetResidencyManager', `Asset is not registered: ${id}`);
    return asset;
  }

  _releaseDependencies(asset) {
    if (asset.dependencyRefs === 0) return;
    const count = asset.dependencyRefs;
    asset.dependencyRefs = 0;
    for (const dependency of asset.dependencies) {
      const child = this._asset(dependency);
      child.refs = Math.max(0, child.refs - count);
      if (child.refs === 0) this._releaseDependencies(child);
    }
  }
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default AssetResidencyManager;
