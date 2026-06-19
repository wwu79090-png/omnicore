import { describe, expect, it } from 'vitest';
import {
  compareBenchmarkResults,
  formatRegressionReport,
  normalizeBenchmarkResult
} from '../scripts/benchmark-threshold.js';

const baseline = {
  summary: {
    particles1000AvgFps: 60,
    entitySync500AvgMs: 1.2,
    backendSwitchAvgMs: 0.3,
    canvas1000SpriteFps: 60,
    pixi1000SpriteFps: 58,
    canvasDrawCalls: 1000,
    complexScene1200Fps: 55,
    complexScene1200DrawCalls: 4,
    complexScene1200CollisionPairs: 480000,
    complexScene1200MaterialSwitches: 28800
  }
};

describe('benchmark threshold regression gate', () => {
  it('fails when draw calls regress by more than 5 percent', () => {
    const current = {
      summary: {
        ...baseline.summary,
        canvasDrawCalls: 1061
      }
    };

    const comparison = compareBenchmarkResults({ baseline, current, threshold: 0.05 });

    expect(comparison.passed).toBe(false);
    expect(comparison.regressions).toEqual([
      expect.objectContaining({
        key: 'canvasDrawCalls',
        regressionRatio: expect.closeTo(0.061, 3)
      })
    ]);
  });

  it('allows regressions at or below the 5 percent threshold', () => {
    const current = {
      summary: {
        ...baseline.summary,
        canvasDrawCalls: 1050
      }
    };

    const comparison = compareBenchmarkResults({ baseline, current, threshold: 0.05 });

    expect(comparison.passed).toBe(true);
    expect(comparison.regressions).toEqual([]);
  });

  it('formats a Chinese performance regression report for CI comments', () => {
    const comparison = compareBenchmarkResults({
      baseline: { summary: { ...baseline.summary, entitySync500AvgMs: 1.2 } },
      current: { summary: { ...baseline.summary, entitySync500AvgMs: 2.4 } },
      threshold: 0.05
    });
    const report = formatRegressionReport(comparison);

    expect(report).toContain('性能下降报告');
    expect(report).toContain('entitySync500AvgMs');
  });

  it('normalizes benchmark output from summary and run details', () => {
    const normalized = normalizeBenchmarkResult({
      builtInRuns: [
        { particles1000: { fps: 60, drawCallsPerFrame: 1001 }, entitySync500: { ms: 1.2 }, backendSwitch: { ms: 0.3 } },
        { particles1000: { fps: 58, drawCallsPerFrame: 1001 }, entitySync500: { ms: 1.4 }, backendSwitch: { ms: 0.5 } }
      ],
      engineCanvas: { fps: 61, drawCallsPerFrame: 1000 },
      enginePixi: { fps: 57, drawCallsPerFrame: 1000 }
    });

    expect(normalized.metrics).toMatchObject({
      particles1000AvgFps: 59,
      entitySync500AvgMs: 1.3,
      backendSwitchAvgMs: 0.4,
      canvas1000SpriteFps: 61,
      pixi1000SpriteFps: 57,
      particles1000DrawCalls: 1001,
      canvasDrawCalls: 1000,
      pixiDrawCalls: 1000
    });
  });

  it('normalizes complex market stress-pack metrics', () => {
    const normalized = normalizeBenchmarkResult({
      complexStress: {
        fps: 57,
        drawCallsPerFrame: 4,
        collisionPairs: 501120,
        materialSwitches: 28800
      }
    });

    expect(normalized.metrics).toMatchObject({
      complexScene1200Fps: 57,
      complexScene1200DrawCalls: 4,
      complexScene1200CollisionPairs: 501120,
      complexScene1200MaterialSwitches: 28800
    });
  });

  it('fails when complex scene FPS regresses beyond threshold', () => {
    const comparison = compareBenchmarkResults({
      baseline,
      current: {
        summary: {
          ...baseline.summary,
          complexScene1200Fps: 51
        }
      },
      threshold: 0.05
    });

    expect(comparison.passed).toBe(false);
    expect(comparison.regressions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'complexScene1200Fps' })
    ]));
  });
});
