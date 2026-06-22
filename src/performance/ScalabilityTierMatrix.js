export class ScalabilityTierMatrix {
  constructor({ tiers = DEFAULT_TIERS } = {}) {
    this.tiers = Object.fromEntries(Object.entries(tiers).map(([id, settings]) => [String(id), clone(settings)]));
  }

  resolveTier(id) {
    return clone(this.tiers[String(id)] || null);
  }

  planTransition(from, to) {
    const fromTier = this.resolveTier(from) || {};
    const toTier = this.resolveTier(to) || {};
    const keys = [...new Set([...Object.keys(fromTier), ...Object.keys(toTier)])].sort();
    return {
      from: String(from),
      to: String(to),
      changed: keys
        .filter((key) => JSON.stringify(fromTier[key]) !== JSON.stringify(toTier[key]))
        .map((setting) => ({ setting, from: fromTier[setting], to: toTier[setting] })),
      appliedSettings: clone(toTier)
    };
  }

  snapshot() {
    return { tiers: clone(this.tiers) };
  }
}

const DEFAULT_TIERS = {
  low: { renderScale: 0.65, shadowQuality: 0, textureQuality: 1, effectsQuality: 0 },
  medium: { renderScale: 0.85, shadowQuality: 1, textureQuality: 2, effectsQuality: 1 },
  high: { renderScale: 1, shadowQuality: 3, textureQuality: 3, effectsQuality: 3 },
  cinematic: { renderScale: 1.25, shadowQuality: 4, textureQuality: 4, effectsQuality: 4 }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default ScalabilityTierMatrix;
