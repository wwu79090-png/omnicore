export class PerformanceBudgetEnvelope {
  constructor({ budgets = {} } = {}) {
    this.budgets = normalizeBudgets(budgets);
  }

  evaluate(metrics = {}) {
    const violations = [];
    for (const [metric, budget] of Object.entries(this.budgets)) {
      const value = Number(metrics[metric]);
      if (!Number.isFinite(value)) continue;
      const violation = evaluateMetric(metric, value, budget);
      if (violation) violations.push(violation);
    }
    violations.sort((left, right) => right.ratio - left.ratio || left.metric.localeCompare(right.metric));
    return {
      status: violations.length ? 'over-budget' : 'ok',
      score: scoreFromViolations(violations),
      primaryBottleneck: violations[0]?.category || null,
      overBudgetMetrics: violations.map((violation) => violation.metric),
      violations
    };
  }
}

function normalizeBudgets(budgets) {
  return Object.fromEntries(Object.entries(budgets || {}).map(([metric, config]) => {
    const normalized = typeof config === 'number' ? { max: config } : { ...config };
    return [metric, {
      ...normalized,
      category: normalized.category || inferCategory(metric),
      min: toOptionalNumber(normalized.min),
      max: toOptionalNumber(normalized.max)
    }];
  }));
}

function evaluateMetric(metric, value, budget) {
  if (budget.max != null && value > budget.max) {
    const ratio = round(value / budget.max);
    return {
      metric,
      category: budget.category,
      value,
      budget: budget.max,
      direction: 'max',
      ratio,
      severity: severityForRatio(ratio)
    };
  }
  if (budget.min != null && value < budget.min) {
    const ratio = round(budget.min / Math.max(value, 0.001));
    return {
      metric,
      category: budget.category,
      value,
      budget: budget.min,
      direction: 'min',
      ratio,
      severity: severityForRatio(ratio)
    };
  }
  return null;
}

function severityForRatio(ratio) {
  if (ratio >= 2) return 'critical';
  if (ratio >= 1.5) return 'warning';
  return 'notice';
}

function scoreFromViolations(violations) {
  if (!violations.length) return 100;
  const penalty = violations.reduce((sum, violation) => sum + Math.min(30, Math.round((violation.ratio - 1) * 30)), 0);
  return Math.max(0, 100 - penalty);
}

function inferCategory(metric) {
  const key = String(metric).toLowerCase();
  if (key.includes('cpu')) return 'cpu';
  if (key.includes('gpu') || key.includes('draw')) return 'gpu';
  if (key.includes('memory') || key.includes('heap')) return 'memory';
  if (key.includes('net') || key.includes('packet')) return 'network';
  return 'frame';
}

function toOptionalNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value) {
  return Number(value.toFixed(3));
}

export default PerformanceBudgetEnvelope;
