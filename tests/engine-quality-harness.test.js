import { describe, expect, it } from 'vitest';
import {
  runBudgetCheck,
  runDeterminismCheck,
  runEngineQualityGate,
  runInvariantCheck,
  runTrendCheck,
  stableHash,
  stableStringify
} from '../src/quality/EngineQualityHarness.js';

describe('engine quality harness', () => {
  it('hashes snapshots deterministically regardless of object key order', () => {
    const left = { entity: { y: 2, x: 1 }, tags: ['npc', 'solid'] };
    const right = { tags: ['npc', 'solid'], entity: { x: 1, y: 2 } };

    expect(stableStringify(left)).toBe(stableStringify(right));
    expect(stableHash(left)).toBe(stableHash(right));
  });

  it('passes deterministic seeded world replays', () => {
    const result = runDeterminismCheck({
      createWorld: createSeededWorld,
      steps: 24,
      seed: 42
    });

    expect(result.ok).toBe(true);
    expect(result.frames).toBe(24);
    expect(result.firstMismatch).toBeNull();
    expect(result.hashes.runA).toEqual(result.hashes.runB);
  });

  it('reports the first mismatched frame for non-deterministic worlds', () => {
    let run = 0;
    const result = runDeterminismCheck({
      createWorld: ({ seed }) => {
        run += 1;
        return {
          entities: [{ id: 'hero', x: seed + run, y: 0 }],
          step() {
            this.entities[0].x += 1;
          }
        };
      },
      steps: 6,
      seed: 3
    });

    expect(result.ok).toBe(false);
    expect(result.firstMismatch).toEqual(expect.objectContaining({
      frame: 0,
      runAHash: expect.any(String),
      runBHash: expect.any(String)
    }));
  });

  it('rejects invalid runtime world invariants', () => {
    const result = runInvariantCheck({
      entities: [
        { id: 'slime', x: 0, y: 0, width: 16, height: 16, components: ['sprite'] },
        { id: 'slime', x: Number.NaN, y: 0, width: -1, components: 'sprite' },
        { x: 2, y: Number.POSITIVE_INFINITY }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate-entity-id', id: 'slime' }),
      expect.objectContaining({ code: 'non-finite-transform', field: 'x' }),
      expect.objectContaining({ code: 'negative-size', field: 'width' }),
      expect.objectContaining({ code: 'invalid-components' }),
      expect.objectContaining({ code: 'missing-entity-id' })
    ]));
  });

  it('reports exceeded runtime budgets with actionable suggestions', () => {
    const result = runBudgetCheck({
      metrics: {
        frameMs: 24,
        memoryMB: 640,
        drawCalls: 1800
      },
      budgets: {
        frameMs: 16.7,
        memoryMB: 512,
        drawCalls: 1200
      }
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(3);
    expect(result.suggestions.join('\n')).toContain('frameMs');
    expect(result.suggestions.join('\n')).toContain('drawCalls');
  });

  it('detects benchmark trend regressions before absolute budgets fail', () => {
    const result = runTrendCheck({
      baseline: {
        fps: 60,
        frameMs: 15,
        drawCalls: 500,
        memoryMB: 220
      },
      current: {
        fps: 54,
        frameMs: 16,
        drawCalls: 575,
        memoryMB: 245
      },
      tolerances: {
        fpsDrop: 0.05,
        frameMsIncrease: 0.1,
        drawCallsIncrease: 0.1,
        memoryMBIncrease: 0.1
      }
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: 'fps', code: 'trend-regression' }),
      expect.objectContaining({ metric: 'drawCalls', code: 'trend-regression' }),
      expect.objectContaining({ metric: 'memoryMB', code: 'trend-regression' })
    ]));
    expect(result.suggestions.join('\n')).toContain('FPS');
  });

  it('combines checks into a scored quality gate report', () => {
    const report = runEngineQualityGate({
      determinism: {
        createWorld: createSeededWorld,
        steps: 12,
        seed: 7
      },
      world: createSeededWorld({ seed: 7 }),
      metrics: {
        frameMs: 15,
        memoryMB: 256
      },
      budgets: {
        frameMs: 16.7,
        memoryMB: 512
      }
    });

    expect(report.ok).toBe(true);
    expect(report.score).toBe(100);
    expect(report.checks.map((check) => check.name)).toEqual([
      'determinism',
      'invariants',
      'budgets'
    ]);
    expect(report.failures).toEqual([]);
  });

  it('includes trend checks in the combined quality gate', () => {
    const report = runEngineQualityGate({
      trend: {
        baseline: { fps: 60, frameMs: 12, drawCalls: 300 },
        current: { fps: 55, frameMs: 13.5, drawCalls: 360 },
        tolerances: { fpsDrop: 0.03, frameMsIncrease: 0.1, drawCallsIncrease: 0.1 }
      }
    });

    expect(report.ok).toBe(false);
    expect(report.checks.map((check) => check.name)).toEqual(['budgets', 'trends']);
    expect(report.failures).toEqual(expect.arrayContaining([
      expect.objectContaining({ check: 'trends', metric: 'fps' })
    ]));
  });

  it('exposes the quality harness from the public package entry', async () => {
    const module = await import('../src/index.js');

    expect(module.default.Quality).toBe(module.EngineQualityHarness);
    expect(module.EngineQualityHarness.runEngineQualityGate).toBe(module.runEngineQualityGate);
    expect(module.EngineQualityHarness.runTrendCheck).toBe(module.runTrendCheck);
    expect(typeof module.stableHash).toBe('function');
  });
});

function createSeededWorld({ seed = 1 } = {}) {
  let state = normalizeSeed(seed);
  const entities = [
    { id: 'hero', x: 0, y: 0, width: 16, height: 16, components: ['sprite', 'body'] },
    { id: 'npc', x: 32, y: 12, width: 16, height: 16, components: ['ai'] }
  ];

  return {
    entities,
    step(frame) {
      state = nextSeed(state);
      const delta = (state % 7) - 3;
      entities[0].x += delta;
      entities[1].y += frame % 2 === 0 ? 1 : -1;
    },
    snapshot() {
      return entities.map((entity) => ({
        id: entity.id,
        x: entity.x,
        y: entity.y,
        components: entity.components
      }));
    }
  };
}

function normalizeSeed(seed) {
  const normalized = Math.abs(Math.trunc(Number(seed) || 1)) % 2147483647;
  return normalized === 0 ? 1 : normalized;
}

function nextSeed(seed) {
  return (seed * 48271) % 2147483647;
}
