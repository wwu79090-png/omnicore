import { describe, expect, it } from 'vitest';
import { FrameDiagnosticsCapture } from '../src/index.js';

describe('engine performance diagnostics pack', () => {
  it('captures profiler lanes, bottlenecks, recommendations, and trace events', () => {
    const capture = new FrameDiagnosticsCapture({
      frameBudgetMs: 16,
      budgets: {
        renderMs: 6,
        scriptMs: 4,
        physicsMs: 3,
        gpuMs: 7,
        memoryMB: 512,
        drawCalls: 900
      }
    });

    capture.recordFrame({
      frame: 101,
      deltaMs: 18.5,
      renderMs: 7.2,
      scriptMs: 4.5,
      physicsMs: 2.4,
      gpuMs: 8.3,
      memoryMB: 540,
      drawCalls: 940,
      markers: [
        { lane: 'render', name: 'sprite-batch', startMs: 1, durationMs: 5.5 },
        { lane: 'script', name: 'ai-tick', startMs: 8, durationMs: 4.5 }
      ],
      warnings: ['texture-upload-on-frame']
    });
    capture.recordFrame({
      frame: 102,
      deltaMs: 14.2,
      renderMs: 4.1,
      scriptMs: 2.3,
      physicsMs: 1.8,
      gpuMs: 5.2,
      memoryMB: 500,
      drawCalls: 620,
      markers: [
        { lane: 'physics', name: 'narrowphase', startMs: 6, durationMs: 1.8 }
      ]
    });

    const report = capture.analyze({ topN: 2 });

    expect(report.summary).toEqual({
      frameCount: 2,
      averageFrameMs: 16.35,
      p95FrameMs: 18.5,
      worstFrame: 101,
      worstFrameMs: 18.5,
      overBudgetFrames: [101],
      ready: false
    });
    expect(report.lanes).toEqual({
      render: { totalMs: 11.3, averageMs: 5.65, worstFrame: 101, worstMs: 7.2 },
      script: { totalMs: 6.8, averageMs: 3.4, worstFrame: 101, worstMs: 4.5 },
      physics: { totalMs: 4.2, averageMs: 2.1, worstFrame: 101, worstMs: 2.4 },
      gpu: { totalMs: 13.5, averageMs: 6.75, worstFrame: 101, worstMs: 8.3 }
    });
    expect(report.topMarkers.map((marker) => marker.name)).toEqual(['sprite-batch', 'ai-tick']);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      'frame-budget-exceeded',
      'lane-budget-exceeded',
      'lane-budget-exceeded',
      'lane-budget-exceeded',
      'memory-budget-exceeded',
      'draw-call-budget-exceeded',
      'runtime-warning'
    ]);
    expect(report.recommendations).toEqual([
      'captureRenderDocOrPixiBatchDiagnostics',
      'splitLongScriptTasks',
      'reduceGpuOverdrawOrShaderCost',
      'runTextureMemoryAudit',
      'enableBatchingOrInstanceStaticGeometry',
      'moveTextureUploadsOffGameplayFrames'
    ]);
    expect(report.traceEvents).toEqual([
      {
        name: 'sprite-batch',
        cat: 'render',
        ph: 'X',
        ts: 1617000,
        dur: 5500,
        pid: 1,
        tid: 1,
        args: { frame: 101, lane: 'render' }
      },
      {
        name: 'ai-tick',
        cat: 'script',
        ph: 'X',
        ts: 1624000,
        dur: 4500,
        pid: 1,
        tid: 2,
        args: { frame: 101, lane: 'script' }
      },
      {
        name: 'narrowphase',
        cat: 'physics',
        ph: 'X',
        ts: 1638000,
        dur: 1800,
        pid: 1,
        tid: 3,
        args: { frame: 102, lane: 'physics' }
      }
    ]);
    expect(report.crossEngineProfile.sources).toEqual([
      'Unity Profiler',
      'Unreal Insights',
      'Godot Profiler',
      'Chrome Performance trace'
    ]);
  });

  it('marks reports as not ready when a lane exceeds budget without a frame hitch', () => {
    const capture = new FrameDiagnosticsCapture({
      frameBudgetMs: 16,
      budgets: { scriptMs: 3 }
    });

    capture.recordFrame({
      frame: 7,
      deltaMs: 12,
      scriptMs: 4.2
    });

    const report = capture.analyze();

    expect(report.summary.ready).toBe(false);
    expect(report.summary.overBudgetFrames).toEqual([]);
    expect(report.issues).toMatchObject([
      {
        code: 'lane-budget-exceeded',
        lane: 'script',
        frame: 7,
        value: 4.2,
        budget: 3
      }
    ]);
  });
});
