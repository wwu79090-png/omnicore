export class PerformanceRegressionGuard {
  constructor({ baselines = {} } = {}) {
    this.baselines = Object.fromEntries(Object.entries(baselines).map(([metric, config]) => [metric, normalizeBaseline(config)]));
  }

  compare(current = {}) {
    const regressions = [];
    for (const [metric, baseline] of Object.entries(this.baselines)) {
      const value = Number(current[metric]);
      if (!Number.isFinite(value)) continue;
      const regression = evaluateRegression(metric, baseline, value);
      if (regression) regressions.push(regression);
    }
    regressions.sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity)
      || right.worseBy - left.worseBy
      || left.metric.localeCompare(right.metric));
    return {
      passed: regressions.length === 0,
      score: scoreFromRegressions(regressions),
      primaryRegression: regressions[0]?.metric || null,
      regressions
    };
  }
}

function normalizeBaseline(config) {
  const value = typeof config === 'number' ? config : config.value;
  return {
    value: Number(value) || 0,
    direction: config.direction || 'lower',
    tolerance: Math.max(0, Number(config.tolerance) || 0)
  };
}

function evaluateRegression(metric, baseline, current) {
  if (baseline.direction === 'higher') {
    const threshold = baseline.value * (1 - baseline.tolerance);
    if (current >= threshold) return null;
    const ratio = round(baseline.value / Math.max(current, 0.001));
    const worseBy = round((threshold - current) / Math.max(threshold, 0.001));
    return formatRegression(metric, baseline, current, ratio, worseBy);
  }
  const threshold = baseline.value * (1 + baseline.tolerance);
  if (current <= threshold) return null;
  const ratio = round(current / Math.max(baseline.value, 0.001));
  const worseBy = round((current - threshold) / Math.max(threshold, 0.001));
  return formatRegression(metric, baseline, current, ratio, worseBy);
}

function formatRegression(metric, baseline, current, ratio, worseBy) {
  return {
    metric,
    direction: baseline.direction,
    baseline: baseline.value,
    current,
    tolerance: baseline.tolerance,
    ratio,
    worseBy,
    severity: ratio >= 1.3 || worseBy >= 0.15 ? 'critical' : 'warning'
  };
}

function scoreFromRegressions(regressions) {
  if (!regressions.length) return 100;
  const penalty = regressions.reduce((sum, item) => sum + (item.severity === 'critical' ? 35 : 18), 0);
  return Math.max(0, 100 - penalty);
}

function severityWeight(severity) {
  return severity === 'critical' ? 2 : 1;
}

function round(value) {
  return Number(value.toFixed(3));
}

export default PerformanceRegressionGuard;
