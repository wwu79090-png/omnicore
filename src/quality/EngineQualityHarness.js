import { createOmniError } from '../core/OmniError.js';

const DEFAULT_TRANSFORM_FIELDS = ['x', 'y', 'z', 'rotation', 'scale', 'scaleX', 'scaleY', 'alpha'];
const DEFAULT_SIZE_FIELDS = ['width', 'height', 'radius'];
const DEFAULT_BUDGETS = {
  frameMs: 16.7,
  memoryMB: 512,
  drawCalls: 1200,
  entityCount: 5000
};

export function stableStringify(value) {
  return stringifyStable(value, new WeakSet());
}

export function stableHash(value) {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash * 16777619) + input.charCodeAt(index)) % 4294967296;
  }
  return Math.floor(hash).toString(16).padStart(8, '0');
}

export function runDeterminismCheck({
  createWorld,
  stepWorld,
  snapshotWorld,
  steps = 120,
  seed = 1
} = {}) {
  if (typeof createWorld !== 'function') {
    throw createOmniError('Quality', 'runDeterminismCheck requires createWorld(options).');
  }

  const runA = replayWorld({
    createWorld,
    stepWorld,
    snapshotWorld,
    steps,
    seed
  });
  const runB = replayWorld({
    createWorld,
    stepWorld,
    snapshotWorld,
    steps,
    seed
  });
  const firstMismatch = findFirstMismatch(runA.hashes, runB.hashes);

  return {
    name: 'determinism',
    ok: firstMismatch == null,
    seed,
    frames: steps,
    firstMismatch,
    hashes: {
      runA: runA.hashes,
      runB: runB.hashes
    }
  };
}

export function runInvariantCheck(world, {
  transformFields = DEFAULT_TRANSFORM_FIELDS,
  sizeFields = DEFAULT_SIZE_FIELDS
} = {}) {
  const entities = collectEntities(world);
  const seenIds = new Set();
  const failures = [];

  entities.forEach((entity, index) => {
    const id = entity?.id ?? entity?.name ?? null;
    if (!id) {
      failures.push({
        code: 'missing-entity-id',
        index,
        message: `Entity at index ${index} is missing an id.`
      });
    } else if (seenIds.has(String(id))) {
      failures.push({
        code: 'duplicate-entity-id',
        id: String(id),
        index,
        message: `Entity id "${id}" appears more than once.`
      });
    } else {
      seenIds.add(String(id));
    }

    for (const field of transformFields) {
      if (!Object.prototype.hasOwnProperty.call(entity || {}, field)) continue;
      const value = Number(entity[field]);
      if (!Number.isFinite(value)) {
        failures.push({
          code: 'non-finite-transform',
          id,
          index,
          field,
          value: entity[field],
          message: `Entity "${id || index}" has non-finite ${field}.`
        });
      }
    }

    for (const field of sizeFields) {
      if (!Object.prototype.hasOwnProperty.call(entity || {}, field)) continue;
      const value = Number(entity[field]);
      if (Number.isFinite(value) && value < 0) {
        failures.push({
          code: 'negative-size',
          id,
          index,
          field,
          value,
          message: `Entity "${id || index}" has negative ${field}.`
        });
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(entity || {}, 'components')
      && !Array.isArray(entity.components)
      && !isPlainObject(entity.components)
    ) {
      failures.push({
        code: 'invalid-components',
        id,
        index,
        message: `Entity "${id || index}" components must be an array or object.`
      });
    }
  });

  return {
    name: 'invariants',
    ok: failures.length === 0,
    entityCount: entities.length,
    failures,
    suggestions: failures.map((failure) => invariantSuggestion(failure))
  };
}

export function runBudgetCheck({
  metrics = {},
  budgets = DEFAULT_BUDGETS
} = {}) {
  const failures = [];

  for (const [metric, limit] of Object.entries(budgets)) {
    const value = Number(metrics[metric]);
    const max = Number(limit);
    if (!Number.isFinite(value) || !Number.isFinite(max)) continue;
    if (value <= max) continue;
    failures.push({
      code: 'budget-exceeded',
      metric,
      value,
      limit: max,
      overBy: Number((value - max).toFixed(3)),
      message: `${metric} exceeded ${max} with ${value}.`
    });
  }

  return {
    name: 'budgets',
    ok: failures.length === 0,
    metrics,
    budgets,
    failures,
    suggestions: failures.map((failure) => budgetSuggestion(failure))
  };
}

export function runTrendCheck({
  baseline = {},
  current = {},
  tolerances = {}
} = {}) {
  const failures = [];
  const comparisons = [];
  const metrics = new Set([
    ...Object.keys(baseline || {}),
    ...Object.keys(current || {})
  ]);

  for (const metric of metrics) {
    const baselineValue = Number(baseline[metric]);
    const currentValue = Number(current[metric]);
    if (!Number.isFinite(baselineValue) || !Number.isFinite(currentValue) || baselineValue === 0) continue;
    const direction = metric.toLowerCase().includes('fps') ? 'lower-is-worse' : 'higher-is-worse';
    const toleranceKey = direction === 'lower-is-worse' ? `${metric}Drop` : `${metric}Increase`;
    const tolerance = normalizeTolerance(tolerances[toleranceKey] ?? tolerances[metric] ?? tolerances.default);
    const ratio = direction === 'lower-is-worse'
      ? (baselineValue - currentValue) / Math.abs(baselineValue)
      : (currentValue - baselineValue) / Math.abs(baselineValue);
    const regression = ratio > tolerance;
    const comparison = {
      metric,
      baseline: baselineValue,
      current: currentValue,
      direction,
      tolerance,
      changeRatio: Number(ratio.toFixed(4)),
      changePercent: Number((ratio * 100).toFixed(2)),
      regression
    };
    comparisons.push(comparison);
    if (regression) {
      failures.push({
        code: 'trend-regression',
        metric,
        baseline: baselineValue,
        current: currentValue,
        tolerance,
        changePercent: comparison.changePercent,
        message: `${metric} regressed by ${comparison.changePercent}% against baseline.`
      });
    }
  }

  return {
    name: 'trends',
    ok: failures.length === 0,
    comparisons,
    failures,
    suggestions: failures.map((failure) => trendSuggestion(failure))
  };
}

export function runEngineQualityGate({
  determinism = null,
  world = null,
  invariants = {},
  metrics = {},
  budgets = DEFAULT_BUDGETS,
  trend = null,
  generatedAt = new Date().toISOString()
} = {}) {
  const checks = [];
  if (determinism) checks.push(runDeterminismCheck(determinism));
  if (world) checks.push(runInvariantCheck(world, invariants));
  if (metrics || budgets) checks.push(runBudgetCheck({ metrics, budgets }));
  if (trend) checks.push(runTrendCheck(trend));

  const failures = checks.flatMap((check) => {
    if (check.ok) return [];
    if (Array.isArray(check.failures)) {
      return check.failures.map((failure) => ({
        check: check.name,
        ...failure
      }));
    }
    return [{
      check: check.name,
      code: 'check-failed',
      message: `${check.name} check failed.`
    }];
  });
  const suggestions = checks.flatMap((check) => check.suggestions || []);
  const score = Math.max(0, 100 - (failures.length * 10));

  return {
    generatedAt,
    ok: failures.length === 0,
    score,
    checks,
    failures,
    suggestions
  };
}

function replayWorld({
  createWorld,
  stepWorld,
  snapshotWorld,
  steps,
  seed
}) {
  const world = createWorld({ seed });
  const hashes = [];

  for (let frame = 0; frame < steps; frame += 1) {
    const frameSnapshot = captureSnapshot(world, snapshotWorld);
    hashes.push(stableHash(frameSnapshot));
    if (typeof stepWorld === 'function') stepWorld(world, frame, seed);
    else if (typeof world?.step === 'function') world.step(frame, seed);
    else if (typeof world?.update === 'function') world.update(1 / 60, frame, seed);
  }

  return { world, hashes };
}

function captureSnapshot(world, snapshotWorld) {
  if (typeof snapshotWorld === 'function') return snapshotWorld(world);
  if (typeof world?.snapshot === 'function') return world.snapshot();
  return {
    entities: collectEntities(world),
    state: world?.state || null
  };
}

function findFirstMismatch(left, right) {
  const frames = Math.max(left.length, right.length);
  for (let frame = 0; frame < frames; frame += 1) {
    if (left[frame] === right[frame]) continue;
    return {
      frame,
      runAHash: left[frame] || null,
      runBHash: right[frame] || null
    };
  }
  return null;
}

function collectEntities(world) {
  if (!world) return [];
  if (Array.isArray(world)) return world;
  if (Array.isArray(world.entities)) return world.entities;
  if (Array.isArray(world.children)) return world.children;
  if (Array.isArray(world.scene?.entities)) return world.scene.entities;
  if (Array.isArray(world.scene?.children)) return world.scene.children;
  if (world.entities instanceof Map) return Array.from(world.entities.values());
  return [];
}

function stringifyStable(value, seen) {
  if (value === null) return 'null';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return '"__NaN__"';
    if (value === Number.POSITIVE_INFINITY) return '"__Infinity__"';
    if (value === Number.NEGATIVE_INFINITY) return '"__-Infinity__"';
    return JSON.stringify(value);
  }
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'undefined') return '"__undefined__"';
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (typeof value === 'function') return JSON.stringify(`[Function:${value.name || 'anonymous'}]`);
  if (Array.isArray(value)) return `[${value.map((item) => stringifyStable(item, seen)).join(',')}]`;
  if (value instanceof Map) {
    const entries = Array.from(value.entries())
      .sort(([left], [right]) => String(left).localeCompare(String(right)));
    return stringifyStable(Object.fromEntries(entries), seen);
  }
  if (value instanceof Set) {
    return stringifyStable(Array.from(value).sort(), seen);
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '"__circular__"';
    seen.add(value);
    const entries = Object.keys(value)
      .sort()
      .filter((key) => typeof value[key] !== 'undefined')
      .map((key) => `${JSON.stringify(key)}:${stringifyStable(value[key], seen)}`);
    seen.delete(value);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function isPlainObject(value) {
  return Boolean(value) && Object.prototype.toString.call(value) === '[object Object]';
}

function invariantSuggestion(failure) {
  if (failure.code === 'duplicate-entity-id') return `Resolve duplicate entity id "${failure.id}" before serializing scene state.`;
  if (failure.code === 'missing-entity-id') return 'Assign stable ids to every runtime entity so replay snapshots can be compared.';
  if (failure.code === 'non-finite-transform') return `Clamp or reject non-finite transform field ${failure.field}.`;
  if (failure.code === 'negative-size') return `Clamp ${failure.field} to zero or a positive size before render/physics sync.`;
  if (failure.code === 'invalid-components') return 'Store components as an array or component map object.';
  return failure.message;
}

function budgetSuggestion(failure) {
  if (failure.metric === 'frameMs') return `frameMs is ${failure.overBy} over budget; profile update/render hot paths and reduce per-frame allocations.`;
  if (failure.metric === 'drawCalls') return `drawCalls is ${failure.overBy} over budget; batch sprites by texture/material or precompile static layers.`;
  if (failure.metric === 'memoryMB') return `memoryMB is ${failure.overBy} over budget; inspect asset residency and object pool growth.`;
  if (failure.metric === 'entityCount') return `entityCount is ${failure.overBy} over budget; add culling, sleep/wake, or chunk streaming.`;
  return `${failure.metric} exceeded budget by ${failure.overBy}.`;
}

function trendSuggestion(failure) {
  const metric = String(failure.metric || '');
  if (metric.toLowerCase().includes('fps')) return `FPS trend dropped ${failure.changePercent}%; compare renderer backend, batching, and scene-update changes against the baseline run.`;
  if (metric.toLowerCase().includes('draw')) return `drawCalls increased ${failure.changePercent}%; inspect batch breaks, atlas churn, and material switching.`;
  if (metric.toLowerCase().includes('memory')) return `memoryMB increased ${failure.changePercent}%; inspect asset residency, texture lifecycle, and object pool growth.`;
  if (metric.toLowerCase().includes('physics')) return `physics cost increased ${failure.changePercent}%; inspect broadphase pair counts and sleep/wake thresholds.`;
  if (metric.toLowerCase().includes('frame')) return `frame time increased ${failure.changePercent}%; inspect profiler hot sections and per-frame allocations.`;
  return `${metric} regressed ${failure.changePercent}% against the previous baseline.`;
}

function normalizeTolerance(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.05;
  return Math.max(0, number);
}

export default {
  stableStringify,
  stableHash,
  runDeterminismCheck,
  runInvariantCheck,
  runBudgetCheck,
  runTrendCheck,
  runEngineQualityGate
};
