export class GameSettingsProfile {
  constructor({ defaults = {}, platforms = {} } = {}) {
    this.defaults = clone(defaults || {});
    this.platforms = clone(platforms || {});
  }

  resolve(platform = 'default') {
    return deepMerge(this.defaults, this.platforms[platform] || {});
  }

  validate(platform = 'default', metrics = {}) {
    const settings = this.resolve(platform);
    const budgets = settings.budgets || {};
    const warnings = [];
    for (const [metric, limit] of Object.entries(budgets)) {
      const actual = Number(metrics[metric] || 0);
      if (actual > Number(limit)) {
        warnings.push({
          code: `${budgetCode(metric)}-budget-exceeded`,
          metric,
          limit: Number(limit),
          actual
        });
      }
    }
    return {
      ok: warnings.length === 0,
      platform,
      settings,
      warnings
    };
  }

  toJSON() {
    return {
      defaults: clone(this.defaults),
      platforms: clone(this.platforms)
    };
  }
}

function deepMerge(left = {}, right = {}) {
  if (Array.isArray(left) || Array.isArray(right)) return clone(right ?? left);
  if (!isPlainObject(left) || !isPlainObject(right)) return clone(right ?? left);
  const output = clone(left);
  for (const [key, value] of Object.entries(right)) {
    output[key] = isPlainObject(value) && isPlainObject(output[key])
      ? deepMerge(output[key], value)
      : clone(value);
  }
  return output;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function budgetCode(value) {
  return String(value)
    .replace(/MB$/u, '')
    .replace(/[A-Z]/gu, (match) => `-${match.toLowerCase()}`)
    .replace(/^-/, '');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default GameSettingsProfile;
