/**
 * Applies rendering-only quality degradation from a device profile.
 */
export class AdaptiveQualityManager {
  constructor({
    renderer = null,
    culling = null,
    loop = null,
    store = null,
    particleScale = 0.5,
    maxVisibleTileChunks = 6,
    hardMaintain = false,
    targetFps = null,
    lowFpsFrames = 120,
    lowPowerFps = null,
    lowPowerTextureQuality = 0.5,
    lowBatteryThreshold = 0.2
  } = {}) {
    this.renderer = renderer;
    this.culling = culling;
    this.loop = loop;
    this.store = store;
    this.particleScale = particleScale;
    this.maxVisibleTileChunks = maxVisibleTileChunks;
    this.hardMaintain = Boolean(hardMaintain);
    this.targetFps = normalizeOptionalPositiveNumber(targetFps);
    this.lowFpsFrames = Math.max(1, Math.round(normalizePositiveNumber(lowFpsFrames, 120)));
    this.lowPowerFps = normalizeOptionalPositiveNumber(lowPowerFps);
    this.lowPowerTextureQuality = clampNumber(lowPowerTextureQuality, 0.1, 1, 0.5);
    this.lowBatteryThreshold = clampNumber(lowBatteryThreshold, 0, 1, 0.2);
    this.lastProfile = null;
    this.lastPowerState = null;
    this.lowFpsCount = 0;
    this.degradationLevel = 0;
  }

  apply(profile = {}) {
    this.lastProfile = profile;
    const applied = [];
    this.renderer?.setQualityProfile?.(profile);

    if (profile.tier !== 'low') {
      return { profile, applied };
    }

    if (this.renderer && this.renderer.enableBloom !== false) {
      this.renderer.enableBloom = false;
      applied.push('disableBloom');
    }

    if (this.renderer && Number.isFinite(this.renderer.particleLimit)) {
      const nextLimit = Math.max(1, Math.floor(this.renderer.particleLimit * this.particleScale));
      if (nextLimit < this.renderer.particleLimit) {
        this.renderer.particleLimit = nextLimit;
        applied.push('reduceParticles');
      }
    }

    if (this.culling) {
      this.culling.maxVisibleTileChunks = this.maxVisibleTileChunks;
      applied.push('limitTileChunks');
    }

    return { profile, applied };
  }

  applyPowerState(powerState = {}) {
    const applied = [];
    const normalized = {
      ...powerState,
      lowPowerMode: Boolean(powerState.lowPowerMode || powerState.saveData),
      batteryLevel: powerState.batteryLevel == null ? null : Number(powerState.batteryLevel),
      thermalState: String(powerState.thermalState || 'nominal').toLowerCase()
    };
    const lowPower = normalized.lowPowerMode
      || (Number.isFinite(normalized.batteryLevel) && normalized.batteryLevel <= this.lowBatteryThreshold)
      || ['serious', 'critical'].includes(normalized.thermalState);

    this.lastPowerState = normalized;
    this.store?.set?.('device:powerState', normalized);
    if (!lowPower) return { powerState: normalized, applied };

    if (this.loop && this.lowPowerFps != null && this.loop.fps !== this.lowPowerFps) {
      this.loop.fps = this.lowPowerFps;
      this.loop.framerateCap = this.lowPowerFps;
      this.loop.frameMs = 1000 / this.lowPowerFps;
      this.loop.uncapped = false;
      applied.push('reduceLoopFps');
    }

    if (this.renderer && this.renderer.textureQuality !== this.lowPowerTextureQuality) {
      this.renderer.textureQuality = this.lowPowerTextureQuality;
      applied.push('reduceTextureQuality');
    }

    if (this.renderer && this.renderer.enableBloom !== false) {
      this.renderer.enableBloom = false;
      applied.push('disableBloom');
    }

    this.renderer?.setQualityProfile?.({
      tier: 'low-power',
      powerState: normalized,
      textureQuality: this.renderer?.textureQuality
    });
    const result = { powerState: normalized, applied };
    this.store?.set?.('renderer:adaptivePower', result);
    return result;
  }

  observeFrame(stats = {}) {
    const fps = normalizePositiveNumber(stats.fps, 0);
    const targetFps = normalizeOptionalPositiveNumber(stats.targetFps ?? this.targetFps);
    if (!this.hardMaintain || fps <= 0) {
      return this._frameResult({ triggered: false, fps, targetFps, applied: [] });
    }
    if (targetFps == null) {
      return this._frameResult({ triggered: false, fps, targetFps, applied: [] });
    }

    if (fps >= targetFps) {
      this.lowFpsCount = 0;
      return this._frameResult({ triggered: false, fps, targetFps, applied: [] });
    }

    this.lowFpsCount += 1;
    if (this.lowFpsCount < this.lowFpsFrames) {
      return this._frameResult({ triggered: false, fps, targetFps, applied: [] });
    }

    this.lowFpsCount = 0;
    this.degradationLevel = Math.min(this.degradationLevel + 1, 3);
    const applied = this.degradationLevel === 1
      ? this._applyRuntimeQuality({ ...stats, fps, targetFps })
      : this._suspendNonCoreEntities(stats.scene);
    const result = this._frameResult({
      triggered: true,
      fps,
      targetFps,
      applied
    });
    this.store?.set?.('renderer:targetFpsHardMaintain', result);
    return result;
  }

  _applyRuntimeQuality({ fps, targetFps } = {}) {
    const applied = [];

    if (this.renderer && this.renderer.enableBloom !== false) {
      this.renderer.enableBloom = false;
      applied.push('disableBloom');
    }

    if (this.renderer && this.renderer.filtersEnabled !== false) {
      this.renderer.filtersEnabled = false;
      this.store?.set?.('renderer:filtersEnabled', false);
      applied.push('disableFilters');
    }

    if (this.renderer && Number.isFinite(this.renderer.particleLimit)) {
      const nextLimit = Math.max(1, Math.floor(this.renderer.particleLimit * this.particleScale));
      if (nextLimit < this.renderer.particleLimit) {
        this.renderer.particleLimit = nextLimit;
        applied.push('reduceParticles');
      }
    }

    if (this.culling) {
      this.culling.padding = 0;
      this.culling.maxVisibleTileChunks = this.maxVisibleTileChunks;
      applied.push('tightenCulling');
    }

    this.renderer?.setQualityProfile?.({
      tier: 'runtime-degraded',
      fps,
      targetFps,
      level: this.degradationLevel
    });
    return applied;
  }

  _suspendNonCoreEntities(scene = {}) {
    const entities = collectEntities(scene.children || []);
    let changed = 0;
    for (const entity of entities) {
      if (!isNonCoreEntity(entity) || isProtectedEntity(entity)) continue;
      entity.visible = false;
      entity.active = false;
      entity.__omnicoreSkipUpdate = true;
      entity.__omnicoreSkipPhysics = true;
      entity.__omnicoreHardMaintained = true;
      if (entity.displayObject) entity.displayObject.visible = false;
      disablePhysicsLike(entity.physics);
      disablePhysicsLike(entity.body);
      disablePhysicsLike(entity.collider);
      disablePhysicsLike(entity.rigidbody);
      changed += 1;
    }
    return changed > 0 ? ['suspendNonCoreEntities'] : [];
  }

  _frameResult({ triggered, fps, targetFps, applied }) {
    return {
      active: this.hardMaintain,
      triggered,
      level: this.degradationLevel,
      fps,
      targetFps,
      applied
    };
  }
}

const NON_CORE_KINDS = new Set([
  'ambient',
  'decoration',
  'decorative',
  'effect',
  'fx',
  'particle',
  'shadow',
  'vfx'
]);

function normalizePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeOptionalPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function collectEntities(items = [], output = []) {
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    output.push(item);
    collectEntities(item.children || item.__children || [], output);
  }
  return output;
}

function isProtectedEntity(entity = {}) {
  return entity.critical === true
    || entity.core === true
    || entity.alwaysRender === true
    || entity.alwaysUpdate === true
    || entity.cullable === false;
}

function isNonCoreEntity(entity = {}) {
  if (entity.nonCritical === true || entity.optional === true || entity.decorative === true) return true;
  if (entity.critical === false || entity.qualityPriority === 'low' || entity.qualityTier === 'low') return true;
  const kind = entity.kind || entity.type || entity.role || entity.entityType;
  if (kind && NON_CORE_KINDS.has(String(kind).toLowerCase())) return true;
  if (Array.isArray(entity.tags)) {
    return entity.tags.some((tag) => NON_CORE_KINDS.has(String(tag).toLowerCase()));
  }
  return false;
}

function disablePhysicsLike(target) {
  if (!target || typeof target !== 'object') return;
  if ('enabled' in target) target.enabled = false;
  if ('active' in target) target.active = false;
}

export default AdaptiveQualityManager;
