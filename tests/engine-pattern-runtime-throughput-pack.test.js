import { describe, expect, it } from 'vitest';
import {
  AssetResidencyManager,
  FramePacingController,
  JobDependencyGraph,
  ServerHandleRegistry,
  TextureStreamingBudget
} from '../src/index.js';

describe('engine pattern runtime throughput pack', () => {
  it('tracks Addressables-style asset references, dependencies, pins, and unload plans', () => {
    const residency = new AssetResidencyManager()
      .register('atlas', { sizeBytes: 400, dependencies: ['texture'] })
      .register('texture', { sizeBytes: 900 })
      .register('music', { sizeBytes: 700 });

    residency.load('atlas').load('atlas').pin('music');
    residency.release('atlas');

    expect(residency.snapshot()).toMatchObject({
      totalResidentBytes: 2000,
      assets: {
        atlas: { refs: 1, resident: true, pinned: false },
        texture: { refs: 2, resident: true, pinned: false },
        music: { refs: 0, resident: true, pinned: true }
      }
    });

    residency.release('atlas');
    expect(residency.unloadPlan({ maxBytes: 1000 }).map((entry) => entry.id)).toEqual(['texture']);
    expect(residency.flushUnloads({ maxBytes: 1000 })).toEqual(['texture']);
    expect(residency.snapshot().totalResidentBytes).toBe(1100);
  });

  it('chooses Unreal-style texture mips and downgrades to fit a streaming pool budget', () => {
    const streamer = new TextureStreamingBudget({ poolBytes: 1200 })
      .register('hero', { fullBytes: 1600, wantedMip: 0, maxMip: 3, priority: 10 })
      .register('tree', { fullBytes: 800, wantedMip: 1, maxMip: 3, priority: 1 })
      .register('ui', { fullBytes: 500, wantedMip: 0, maxMip: 0, priority: 100, pinned: true });

    const plan = streamer.plan();

    expect(plan.textures).toMatchObject({
      hero: { mip: 1, bytes: 800 },
      tree: { mip: 3, bytes: 100 },
      ui: { mip: 0, bytes: 500 }
    });
    expect(plan.totalBytes).toBe(1400);
    expect(plan.overBudgetBytes).toBe(200);
    expect(plan.downgrades.map((entry) => entry.id)).toEqual(['tree', 'hero']);
  });

  it('schedules Unity Job System-style dependency graphs into parallel batches', () => {
    const jobs = new JobDependencyGraph()
      .addJob('readInput')
      .addJob('simulateAI', { dependsOn: ['readInput'] })
      .addJob('simulatePhysics', { dependsOn: ['readInput'] })
      .addJob('syncTransforms', { dependsOn: ['simulateAI', 'simulatePhysics'] });

    expect(jobs.compile().batches).toEqual([
      ['readInput'],
      ['simulateAI', 'simulatePhysics'],
      ['syncTransforms']
    ]);

    const log = [];
    jobs.run({
      handlers: {
        readInput: () => log.push('readInput'),
        simulateAI: () => log.push('simulateAI'),
        simulatePhysics: () => log.push('simulatePhysics'),
        syncTransforms: () => log.push('syncTransforms')
      }
    });
    expect(log).toEqual(['readInput', 'simulateAI', 'simulatePhysics', 'syncTransforms']);
  });

  it('uses Godot-style server handles and flushes batched low-level commands', () => {
    const server = new ServerHandleRegistry({ namespace: 'render' });
    const mesh = server.create('mesh', { vertices: 12 });
    const light = server.create('light', { intensity: 2 });

    server.set(mesh, { vertices: 24 }).set(light, { intensity: 3 }).free(mesh);
    expect(server.flush()).toEqual([
      { op: 'create', rid: 'render:1', type: 'mesh', payload: { vertices: 12 } },
      { op: 'create', rid: 'render:2', type: 'light', payload: { intensity: 2 } },
      { op: 'set', rid: 'render:1', patch: { vertices: 24 } },
      { op: 'set', rid: 'render:2', patch: { intensity: 3 } },
      { op: 'free', rid: 'render:1' }
    ]);
    expect(server.snapshot()).toEqual({
      namespace: 'render',
      handles: [{ rid: 'render:2', type: 'light', payload: { intensity: 3 } }]
    });
  });

  it('detects frame pacing hitches and recommends deterministic mitigation actions', () => {
    const pacing = new FramePacingController({ targetMs: 16.67, hitchMs: 45, windowSize: 5 });
    [16, 17, 19, 52, 18, 60].forEach((frameMs) => pacing.record(frameMs));

    const report = pacing.report();

    expect(report).toMatchObject({
      frames: 5,
      hitches: 2,
      averageMs: 33.2,
      p95Ms: 60,
      overBudgetFrames: 4
    });
    expect(report.actions).toEqual([
      'deferNonCriticalJobs',
      'tightenTexturePool',
      'reduceRenderScale'
    ]);
  });
});
