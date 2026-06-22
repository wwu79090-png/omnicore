export class QualityScalerProfile {
  constructor({ scalers = [] } = {}) {
    this.scalers = scalers.map(normalizeScaler);
  }

  planReduction({ targets = [], maxSteps = Infinity } = {}) {
    const targetList = normalizeArray(targets).map(String);
    const levels = Object.fromEntries(this.scalers.map((scaler) => [scaler.id, scaler.level]));
    const steps = [];

    for (const target of targetList) {
      const scaler = this._bestScalerFor(target, new Set(steps.map((step) => step.id)));
      if (!scaler || steps.length >= maxSteps) continue;
      steps.push({
        id: scaler.id,
        from: levels[scaler.id],
        to: Math.max(scaler.minLevel, levels[scaler.id] - 1),
        reason: target,
        visualImpact: scaler.visualImpact
      });
      levels[scaler.id] = Math.max(scaler.minLevel, levels[scaler.id] - 1);
    }

    return {
      steps,
      projectedLevels: levels
    };
  }

  _bestScalerFor(target, used) {
    return this.scalers
      .filter((scaler) => !used.has(scaler.id) && scaler.targets.includes(target) && scaler.level > scaler.minLevel)
      .sort((left, right) => visualWeight(left.visualImpact) - visualWeight(right.visualImpact)
        || right.level - left.level
        || left.id.localeCompare(right.id))[0] || null;
  }
}

function normalizeScaler(config = {}) {
  const level = Math.max(0, Math.floor(Number(config.level) || 0));
  return {
    id: String(config.id),
    level,
    minLevel: Math.max(0, Math.floor(Number(config.minLevel) || 0)),
    maxLevel: Math.max(level, Math.floor(Number(config.maxLevel) || level)),
    targets: normalizeArray(config.targets).map(String),
    visualImpact: String(config.visualImpact || 'medium')
  };
}

function visualWeight(value) {
  if (value === 'low') return 0;
  if (value === 'medium') return 1;
  if (value === 'high') return 2;
  return 1;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default QualityScalerProfile;
