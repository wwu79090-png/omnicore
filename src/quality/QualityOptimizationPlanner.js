const PRIORITY_WEIGHT = Object.freeze({
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3
});

export class QualityOptimizationPlanner {
  plan({
    matrix = {},
    audit = {}
  } = {}) {
    const steps = [
      ...qualityGapSteps(matrix.features || []),
      ...auditIssueSteps(audit.issues || [])
    ].sort((left, right) => (
      PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority]
      || right.impact - left.impact
      || left.id.localeCompare(right.id)
    ));

    return {
      generatedBy: 'OmniCore quality optimization planner',
      summary: {
        stepCount: steps.length,
        p0Count: steps.filter((step) => step.priority === 'P0').length,
        p1Count: steps.filter((step) => step.priority === 'P1').length,
        estimatedImpact: steps.reduce((total, step) => total + step.impact, 0)
      },
      steps: steps.map(({ impact, ...step }) => step)
    };
  }
}

function qualityGapSteps(features) {
  const steps = [];
  for (const feature of normalizeArray(features)) {
    for (const weak of normalizeArray(feature.weakDimensions)) {
      const gap = normalizeNumber(weak.gap, 0);
      const dimension = String(weak.dimension || 'quality');
      steps.push({
        id: `${feature.id}:raise-${dimension}`,
        feature: String(feature.id || 'feature'),
        priority: gap >= 20 ? 'P0' : 'P1',
        action: `raise-${dimension}`,
        reason: 'quality-gap',
        verification: verificationFor(feature.id),
        impact: Math.round(gap)
      });
    }
  }
  return steps;
}

function auditIssueSteps(issues) {
  return normalizeArray(issues).map((issue) => {
    const feature = String(issue.feature || 'feature');
    const action = actionForIssue(issue.code);
    return {
      id: `${feature}:${action}`,
      feature,
      priority: priorityForIssue(issue),
      action,
      reason: String(issue.code || 'quality-issue'),
      verification: verificationFor(feature),
      impact: impactForIssue(issue.code)
    };
  });
}

function actionForIssue(code) {
  if (code === 'missing-owner') return 'assignOwner';
  if (code === 'missing-failure-modes') return 'addFailureModeTests';
  if (code === 'missing-docs') return 'document';
  if (code === 'missing-examples') return 'addExample';
  if (code === 'missing-tests') return 'addTests';
  return 'fixQualityIssue';
}

function priorityForIssue(issue) {
  if (issue.code === 'missing-failure-modes' || issue.code === 'missing-tests') return 'P0';
  return issue.severity === 'P0' ? 'P0' : 'P1';
}

function impactForIssue(code) {
  if (code === 'missing-failure-modes') return 16;
  if (code === 'missing-owner') return 8;
  if (code === 'missing-tests') return 20;
  if (code === 'missing-docs') return 10;
  if (code === 'missing-examples') return 6;
  return 5;
}

function verificationFor(feature) {
  const id = String(feature || '');
  if (id === 'asset-pipeline') return 'npm test -- tests/build-asset-pipeline.test.js';
  if (id === 'netcode') return 'npm test -- tests/engine-pattern-netcode-resilience-pack.test.js';
  if (id === 'renderer') return 'npm test -- tests/renderer-backends-mvp.test.js';
  if (id === 'scene') return 'npm test -- tests/core-systems.test.js';
  return 'npm test -- tests/engine-function-quality-optimization-pack.test.js';
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export default QualityOptimizationPlanner;
