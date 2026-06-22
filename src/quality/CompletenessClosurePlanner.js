const PRIORITY_WEIGHT = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });

export class CompletenessClosurePlanner {
  plan({
    matrix = {},
    evidence = {}
  } = {}) {
    const steps = [
      ...normalizeArray(matrix.gaps).map(matrixGapStep),
      ...normalizeArray(evidence.issues).map(evidenceIssueStep)
    ].sort((left, right) => (
      PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority]
      || reasonOrder(left.reason) - reasonOrder(right.reason)
      || right.impact - left.impact
      || left.id.localeCompare(right.id)
    ));

    return {
      generatedBy: 'OmniCore completeness closure planner',
      summary: {
        stepCount: steps.length,
        p0Count: steps.filter((step) => step.priority === 'P0').length,
        p1Count: steps.filter((step) => step.priority === 'P1').length,
        estimatedClosure: steps.reduce((total, step) => total + step.impact, 0)
      },
      steps: steps.map(({ impact, ...step }) => step)
    };
  }
}

function matrixGapStep(gap = {}) {
  const area = String(gap.domain || 'engine');
  const type = String(gap.type || 'capability');
  const id = String(gap.id || 'gap');
  return {
    id: `${area}:close-${type}-${id}`,
    area,
    priority: normalizePriority(gap.severity),
    action: `close-${type}-${id}`,
    reason: `${type}-gap`,
    verification: verificationFor(area),
    impact: gap.severity === 'P0' ? 12 : 8
  };
}

function evidenceIssueStep(issue = {}) {
  const area = String(issue.feature || 'feature');
  const type = String(issue.type || 'evidence');
  return {
    id: `${area}:add-${type}`,
    area,
    priority: normalizePriority(issue.severity),
    action: `add-${type}`,
    reason: 'evidence-gap',
    verification: verificationFor(area),
    impact: type === 'tests' ? 10 : 12
  };
}

function normalizePriority(value) {
  return Object.prototype.hasOwnProperty.call(PRIORITY_WEIGHT, value) ? value : 'P1';
}

function reasonOrder(reason) {
  if (reason === 'stage-gap') return 0;
  if (reason === 'capability-gap') return 1;
  if (reason === 'evidence-gap') return 2;
  return 3;
}

function verificationFor(area) {
  if (area === 'asset-pipeline') return 'npm test -- tests/build-asset-pipeline.test.js';
  if (area === 'netcode') return 'npm test -- tests/engine-pattern-netcode-resilience-pack.test.js';
  if (area === 'platform-export') return 'npm test -- tests/engine-pattern-platform-pack.test.js';
  if (area === 'renderer') return 'npm test -- tests/renderer-backends-mvp.test.js';
  return 'npm test -- tests/engine-completeness-optimization-pack.test.js';
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default CompletenessClosurePlanner;
