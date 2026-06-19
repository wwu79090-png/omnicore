export class ABTest {
  constructor({ experiments = {}, random = Math.random } = {}) {
    this.experiments = experiments;
    this.random = random;
  }

  static fromJSON(json = {}, options = {}) {
    return new ABTest({ experiments: json.experiments || {}, ...options });
  }

  select(name, { userId = null, random = null } = {}) {
    const experiment = this.experiments[name];
    if (!experiment) return null;
    const variants = experiment.variants || [];
    const total = variants.reduce((sum, variant) => sum + Number(variant.weight ?? 1), 0);
    if (!variants.length || total <= 0) return null;
    const bucket = userId == null ? (random ?? this.random()) : hashToUnit(String(userId));
    let cursor = 0;
    for (const variant of variants) {
      cursor += Number(variant.weight ?? 1) / total;
      if (bucket <= cursor) return variant;
    }
    return variants[variants.length - 1];
  }
}

function hashToUnit(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000003;
  }
  return hash / 1000003;
}

export default ABTest;
