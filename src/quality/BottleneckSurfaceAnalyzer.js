const SEVERITY_SCORE = Object.freeze({
  critical: 4,
  error: 4,
  warning: 2,
  warn: 2,
  info: 1,
  low: 1
});

export class BottleneckSurfaceAnalyzer {
  analyze({
    budgets = [],
    limits = [],
    regressions = []
  } = {}) {
    const surfaces = new Map();
    const normalizedBudgets = normalizeArray(budgets).map(normalizeBudget);
    const normalizedLimits = normalizeArray(limits).map(normalizeLimit);
    const normalizedRegressions = normalizeArray(regressions).map(normalizeRegression);

    for (const budget of normalizedBudgets) {
      addSignal(surfaces, budget.area, {
        type: 'budget',
        driver: budget.metric,
        score: scoreSeverity(budget.severity),
        signal: budget
      });
    }
    for (const limit of normalizedLimits) {
      addSignal(surfaces, limit.area, {
        type: 'limit',
        driver: limit.id,
        score: limit.kind === 'hard' ? 4 : 2,
        kind: limit.kind,
        signal: limit
      });
    }
    for (const regression of normalizedRegressions) {
      addSignal(surfaces, regression.area, {
        type: 'regression',
        driver: regression.metric,
        score: scoreSeverity(regression.severity),
        signal: regression
      });
    }

    const rankedSurfaces = [...surfaces.values()]
      .map((surface) => ({
        area: surface.area,
        score: surface.score,
        drivers: surface.drivers,
        signals: surface.signals
      }))
      .sort((left, right) => right.score - left.score || left.area.localeCompare(right.area));

    return {
      generatedBy: 'OmniCore bottleneck surface analyzer',
      primaryArea: rankedSurfaces[0]?.area || null,
      surfaces: rankedSurfaces,
      budgets: normalizedBudgets,
      limits: normalizedLimits,
      regressions: normalizedRegressions,
      recommendations: buildRecommendations(rankedSurfaces)
    };
  }
}

function addSignal(surfaces, area, signal) {
  const key = String(area || 'runtime');
  if (!surfaces.has(key)) {
    surfaces.set(key, {
      area: key,
      score: 0,
      drivers: [],
      signals: []
    });
  }

  const surface = surfaces.get(key);
  surface.score += signal.score;
  if (!surface.drivers.includes(signal.driver)) surface.drivers.push(signal.driver);
  surface.signals.push(signal);
}

function normalizeBudget(budget = {}) {
  return {
    area: String(budget.area || 'runtime'),
    metric: String(budget.metric || 'budget'),
    ratio: normalizeNumber(budget.ratio, 1),
    severity: normalizeSeverity(budget.severity || (Number(budget.ratio) > 1 ? 'warning' : 'info'))
  };
}

function normalizeLimit(limit = {}) {
  return {
    id: String(limit.id || 'limit'),
    area: String(limit.area || 'runtime'),
    kind: limit.kind === 'hard' ? 'hard' : 'soft',
    current: normalizeNumber(limit.current, null),
    ceiling: normalizeNumber(limit.ceiling, null),
    status: String(limit.status || 'active')
  };
}

function normalizeRegression(regression = {}) {
  return {
    area: String(regression.area || 'runtime'),
    metric: String(regression.metric || 'regression'),
    severity: normalizeSeverity(regression.severity || 'warning'),
    changePercent: normalizeNumber(regression.changePercent, 0)
  };
}

function buildRecommendations(surfaces) {
  const recommendations = [];
  for (const surface of surfaces) {
    if (surface.signals.some((signal) => signal.type === 'limit' && signal.kind === 'hard')) {
      recommendations.push(`liftLimits:${surface.area}`);
    }
    if (surface.signals.some((signal) => signal.type === 'budget')) {
      recommendations.push(`rebalanceBudget:${surface.area}`);
    }
    if (surface.signals.some((signal) => signal.type === 'regression')) {
      recommendations.push(`lockRegression:${surface.area}`);
    }
  }
  return recommendations;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function normalizeSeverity(value) {
  const severity = String(value || 'info').toLowerCase();
  return Object.prototype.hasOwnProperty.call(SEVERITY_SCORE, severity) ? severity : 'info';
}

function scoreSeverity(severity) {
  return SEVERITY_SCORE[normalizeSeverity(severity)] || 1;
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export default BottleneckSurfaceAnalyzer;
