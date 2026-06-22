import { createOmniError } from '../core/OmniError.js';

export class EngineLimitRegistry {
  constructor({ limits = [] } = {}) {
    this.limits = new Map();
    for (const limit of limits) this.register(limit);
  }

  register(limit) {
    const normalized = normalizeLimit(limit);
    this.limits.set(normalized.id, normalized);
    return this;
  }

  override(id, patch = {}) {
    const key = String(id || '');
    const existing = this.limits.get(key);
    if (!existing) return this.register({ id: key, ...patch });
    this.limits.set(key, normalizeLimit({ ...existing, ...patch, id: key }));
    return this;
  }

  get(id) {
    const limit = this.limits.get(String(id));
    return limit ? clone(limit) : null;
  }

  list() {
    return [...this.limits.values()].map(clone);
  }

  report() {
    const limits = this.list();
    const activeHardLimits = limits.filter((limit) => limit.kind === 'hard' && !isLifted(limit));
    const lifted = limits.filter(isLifted);
    const tunable = limits.filter((limit) => limit.tunable);

    return {
      generatedBy: 'OmniCore engine limit registry',
      summary: {
        total: limits.length,
        hardLimitCount: activeHardLimits.length,
        softLimitCount: limits.filter((limit) => limit.kind === 'soft').length,
        liftedCount: lifted.length,
        tunableCount: tunable.length
      },
      limits: Object.fromEntries(limits.map((limit) => [limit.id, clone(limit)])),
      limitsList: limits,
      recommendations: limits.map(limitRecommendation)
    };
  }
}

function normalizeLimit(limit = {}) {
  const id = String(limit.id || '').trim();
  if (!id) throw createOmniError('Quality', 'EngineLimitRegistry requires limit.id.');
  const kind = limit.kind === 'hard' ? 'hard' : 'soft';
  const current = normalizeOptionalNumber(limit.current);
  const ceiling = normalizeOptionalNumber(limit.ceiling);
  return {
    id,
    area: String(limit.area || 'runtime'),
    kind,
    current,
    ceiling,
    source: String(limit.source || 'unknown'),
    status: String(limit.status || defaultStatus({ kind, current, ceiling })),
    strategy: String(limit.strategy || defaultStrategy(kind)),
    tunable: limit.tunable === true,
    impact: limit.impact == null ? null : String(limit.impact)
  };
}

function normalizeOptionalNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function defaultStatus({ kind, current, ceiling }) {
  if (current != null && ceiling != null && current > ceiling) return 'exceeded';
  return kind === 'hard' ? 'active' : 'monitor';
}

function defaultStrategy(kind) {
  return kind === 'hard' ? 'remove-or-virtualize' : 'tune-budget';
}

function isLifted(limit) {
  return limit.status === 'lifted' || limit.status === 'removed';
}

function limitRecommendation(limit) {
  if (limit.kind === 'hard' && !isLifted(limit)) return `remove:${limit.id}`;
  return `monitor:${limit.id}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default EngineLimitRegistry;
