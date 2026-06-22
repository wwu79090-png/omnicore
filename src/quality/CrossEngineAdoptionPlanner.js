const PRIORITY_WEIGHT = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });

export class CrossEngineAdoptionPlanner {
  plan(adoptions = []) {
    const steps = normalizeArray(adoptions)
      .map(createStep)
      .sort((left, right) => (
        PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority]
        || left.id.localeCompare(right.id)
      ));

    return {
      generatedBy: 'OmniCore cross-engine adoption planner',
      summary: {
        stepCount: steps.length,
        p0Count: steps.filter((step) => step.priority === 'P0').length,
        p1Count: steps.filter((step) => step.priority === 'P1').length,
        estimatedCoverageGain: steps.length * 5
      },
      steps
    };
  }
}

function createStep(adoption = {}) {
  const source = String(adoption.source || 'engine');
  const capability = String(adoption.capability || 'capability');
  const module = String(adoption.module || 'runtime');
  const priority = normalizePriority(adoption.priority);
  return {
    id: `${source}:${capability}`,
    priority,
    module,
    action: `adopt-${capability}`,
    verification: verificationFor({ capability, module })
  };
}

function verificationFor({ capability, module }) {
  if (capability === 'tilemaps') {
    return 'npm test -- tests/engine-pattern-scalability-optimization-pack.test.js tests/phaser-compat-layer.test.js';
  }
  if (capability === 'physics-adapter') {
    return 'npm test -- tests/physics-backends.test.js tests/dimension3d-performance-guards.test.js';
  }
  if (capability === 'texture-gc') {
    return 'npm test -- tests/lifecycle-leak-guards.test.js tests/renderer-backends-mvp.test.js';
  }
  if (module === 'renderer') return 'npm test -- tests/renderer-backends-mvp.test.js';
  if (module === 'physics') return 'npm test -- tests/physics-backends.test.js';
  return 'npm test -- tests/cross-engine-total-parity-pack.test.js';
}

function normalizePriority(priority) {
  return Object.prototype.hasOwnProperty.call(PRIORITY_WEIGHT, priority) ? priority : 'P1';
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default CrossEngineAdoptionPlanner;
