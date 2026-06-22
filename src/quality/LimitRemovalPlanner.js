const PRIORITY_WEIGHT = Object.freeze({
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3
});

export class LimitRemovalPlanner {
  plan(limits = []) {
    const normalized = normalizeArray(limits).map(normalizeLimit);
    const steps = normalized
      .filter((limit) => limit.status !== 'lifted' && limit.status !== 'removed')
      .map(createStep)
      .sort((left, right) => (
        PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority]
        || left.area.localeCompare(right.area)
        || left.id.localeCompare(right.id)
      ));

    return {
      generatedBy: 'OmniCore limit removal planner',
      summary: {
        total: normalized.length,
        planned: steps.length,
        p0Count: steps.filter((step) => step.priority === 'P0').length
      },
      steps
    };
  }
}

function createStep(limit) {
  const hard = limit.kind === 'hard';
  return {
    id: limit.id,
    area: limit.area,
    priority: hard ? 'P0' : 'P1',
    action: hard ? 'virtualize' : 'raise',
    strategy: hard ? 'auto-grow-or-shard' : 'runtime-tunable-budget',
    verification: verificationFor(limit)
  };
}

function verificationFor(limit) {
  if (limit.area === 'renderer' || limit.area === 'performance') return 'npm run benchmark:ci';
  return 'npm test -- tests/engine-limit-removal-pack.test.js';
}

function normalizeLimit(limit = {}) {
  return {
    id: String(limit.id || 'limit'),
    area: String(limit.area || 'runtime'),
    kind: limit.kind === 'hard' ? 'hard' : 'soft',
    status: String(limit.status || 'active')
  };
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default LimitRemovalPlanner;
