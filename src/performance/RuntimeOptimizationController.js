export class RuntimeOptimizationController {
  constructor({ targets = {} } = {}) {
    this.targets = targets;
    this.baseline = cloneTargets(targets);
    this.history = [];
  }

  apply(actions = []) {
    const applied = [];
    for (const action of normalizeArray(actions)) {
      if (this._applyAction(String(action))) applied.push(String(action));
    }
    const result = {
      applied,
      targets: cloneTargets(this.targets)
    };
    this.history.push(result);
    return result;
  }

  rollback() {
    restoreTargets(this.targets, this.baseline);
    this.history.length = 0;
    return {
      restored: true,
      targets: cloneTargets(this.targets)
    };
  }

  snapshot() {
    return {
      targets: cloneTargets(this.targets),
      baseline: cloneTargets(this.baseline),
      history: this.history.map(clone)
    };
  }

  _applyAction(action) {
    const { renderer, network, scheduler, loop, assets } = this.targets;
    if (action === 'reduceRenderScale' && renderer) {
      renderer.renderScale = round(Math.max(0.5, Number(renderer.renderScale ?? 1) * 0.85));
      return true;
    }
    if ((action === 'lowerNetworkSnapshotRate' || action === 'reduceNetSnapshotRate') && network) {
      network.snapshotRate = Math.max(1, Math.floor(Number(network.snapshotRate ?? 30) * 0.5));
      return true;
    }
    if (action === 'deferNonCriticalJobs' && scheduler) {
      scheduler.deferNonCriticalJobs = true;
      return true;
    }
    if (action === 'reduceParticleDensity' && renderer) {
      renderer.particleDensity = round(Math.max(0.1, Number(renderer.particleDensity ?? 1) * 0.5));
      return true;
    }
    if (action === 'reduceTextureResolution' && renderer) {
      renderer.textureResolution = Math.max(0, Math.floor(Number(renderer.textureResolution ?? 2) - 1));
      return true;
    }
    if (action === 'reduceSimulationRate' && loop) {
      loop.simulationRate = Math.max(15, Math.floor(Number(loop.simulationRate ?? 60) * 0.5));
      return true;
    }
    if (action === 'tightenTexturePool' && assets) {
      assets.texturePoolScale = round(Math.max(0.25, Number(assets.texturePoolScale ?? 1) * 0.75));
      return true;
    }
    return false;
  }
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function cloneTargets(targets) {
  return Object.fromEntries(Object.entries(targets).map(([key, value]) => [key, clone(value)]));
}

function restoreTargets(targets, baseline) {
  for (const [key, value] of Object.entries(baseline)) {
    if (!targets[key] || typeof targets[key] !== 'object') {
      targets[key] = clone(value);
      continue;
    }
    for (const prop of Object.keys(targets[key])) delete targets[key][prop];
    Object.assign(targets[key], clone(value));
  }
}

function round(value) {
  return Number(value.toFixed(3));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default RuntimeOptimizationController;
