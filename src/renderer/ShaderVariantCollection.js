export class ShaderVariantCollection {
  constructor() {
    this.variants = new Map();
  }

  add(variant = {}) {
    const normalized = normalizeVariant(variant);
    this.variants.set(normalized.key, normalized);
    return this;
  }

  trackRuntimeUse(shader, options = {}) {
    return this.add({ ...options, shader });
  }

  strip({ platform = null, enabledFeatures = [] } = {}) {
    const features = new Set(normalizeArray(enabledFeatures).map(String));
    const kept = [];
    const stripped = [];
    for (const variant of this._sorted()) {
      const platformOk = !platform || variant.platforms.length === 0 || variant.platforms.includes(platform);
      const featuresOk = variant.features.every((feature) => features.has(feature));
      if (platformOk && featuresOk) kept.push(clone(variant));
      else stripped.push(clone(variant));
    }
    return { kept, stripped };
  }

  warmupPlan(options = {}) {
    return this.strip(options).kept.map((variant) => ({
      shader: variant.shader,
      pass: variant.pass,
      keywords: [...variant.keywords],
      key: variant.key
    }));
  }

  _sorted() {
    return [...this.variants.values()].sort((a, b) => a.key.localeCompare(b.key));
  }
}

function normalizeVariant(variant) {
  const shader = String(variant.shader || 'Default');
  const pass = String(variant.pass || 'Forward');
  const keywords = normalizeArray(variant.keywords).map(String).sort();
  return {
    shader,
    pass,
    keywords,
    platforms: normalizeArray(variant.platforms).map(String).sort(),
    features: normalizeArray(variant.features).map(String).sort(),
    key: `${shader}|${pass}|${keywords.join('+')}`
  };
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default ShaderVariantCollection;
