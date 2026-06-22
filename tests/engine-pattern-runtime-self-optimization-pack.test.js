import { describe, expect, it } from 'vitest';
import {
  PerformanceBudgetEnvelope,
  PerformanceMonitorRegistry,
  QualityScalerProfile,
  RuntimeOptimizationAdvisor
} from '../src/index.js';

describe('engine pattern runtime self optimization pack', () => {
  it('evaluates runtime budgets and identifies the primary bottleneck', () => {
    const envelope = new PerformanceBudgetEnvelope({
      budgets: {
        frameMs: { max: 16.7, category: 'frame' },
        cpuMs: { max: 8, category: 'cpu' },
        gpuMs: { max: 8, category: 'gpu' },
        drawCalls: { max: 1000, category: 'render' },
        memoryMB: { max: 512, category: 'memory' },
        netKbps: { max: 120, category: 'network' }
      }
    });

    const report = envelope.evaluate({
      frameMs: 33.4,
      cpuMs: 21,
      gpuMs: 12,
      drawCalls: 1500,
      memoryMB: 640,
      netKbps: 160
    });

    expect(report).toMatchObject({
      status: 'over-budget',
      primaryBottleneck: 'cpu',
      score: expect.any(Number)
    });
    expect(report.violations[0]).toMatchObject({
      metric: 'cpuMs',
      category: 'cpu',
      ratio: 2.625,
      severity: 'critical'
    });
    expect(report.overBudgetMetrics).toEqual([
      'cpuMs',
      'frameMs',
      'drawCalls',
      'gpuMs',
      'netKbps',
      'memoryMB'
    ]);
  });

  it('plans quality scaler reductions by target metric and visual impact', () => {
    const profile = new QualityScalerProfile({
      scalers: [
        { id: 'shadowQuality', level: 3, minLevel: 0, targets: ['gpuMs'], visualImpact: 'high' },
        { id: 'particleDensity', level: 3, minLevel: 1, targets: ['cpuMs', 'gpuMs'], visualImpact: 'medium' },
        { id: 'textureResolution', level: 3, minLevel: 1, targets: ['memoryMB', 'gpuMs'], visualImpact: 'low' },
        { id: 'netSnapshotRate', level: 3, minLevel: 1, targets: ['netKbps'], visualImpact: 'low' }
      ]
    });

    const plan = profile.planReduction({
      targets: ['memoryMB', 'netKbps', 'gpuMs'],
      maxSteps: 3
    });

    expect(plan.steps).toEqual([
      { id: 'textureResolution', from: 3, to: 2, reason: 'memoryMB', visualImpact: 'low' },
      { id: 'netSnapshotRate', from: 3, to: 2, reason: 'netKbps', visualImpact: 'low' },
      { id: 'particleDensity', from: 3, to: 2, reason: 'gpuMs', visualImpact: 'medium' }
    ]);
    expect(plan.projectedLevels).toMatchObject({
      textureResolution: 2,
      netSnapshotRate: 2,
      particleDensity: 2,
      shadowQuality: 3
    });
  });

  it('samples custom performance monitors and reports budget alerts', () => {
    const registry = new PerformanceMonitorRegistry()
      .register('fps', () => 58, { budget: { min: 60 }, category: 'frame' })
      .register('drawCalls', () => 1200, { budget: { max: 1000 }, category: 'render' })
      .register('activeEnemies', () => 42, { budget: { max: 60 }, category: 'gameplay' });

    const sample = registry.sample({ timeMs: 1000 });

    expect(sample.monitors).toMatchObject({
      fps: { value: 58, status: 'under-min', category: 'frame' },
      drawCalls: { value: 1200, status: 'over-max', category: 'render' },
      activeEnemies: { value: 42, status: 'ok', category: 'gameplay' }
    });
    expect(sample.alerts.map((alert) => alert.id)).toEqual(['fps', 'drawCalls']);
  });

  it('combines budgets, scalers, and capability gates into deterministic optimization advice', () => {
    const envelope = new PerformanceBudgetEnvelope({
      budgets: {
        frameMs: { max: 16.7, category: 'frame' },
        cpuMs: { max: 8, category: 'cpu' },
        memoryMB: { max: 512, category: 'memory' },
        netKbps: { max: 120, category: 'network' }
      }
    });
    const profile = new QualityScalerProfile({
      scalers: [
        { id: 'particleDensity', level: 3, minLevel: 1, targets: ['cpuMs'], visualImpact: 'medium' },
        { id: 'textureResolution', level: 3, minLevel: 1, targets: ['memoryMB'], visualImpact: 'low' },
        { id: 'netSnapshotRate', level: 3, minLevel: 1, targets: ['netKbps'], visualImpact: 'low' }
      ]
    });
    const advisor = new RuntimeOptimizationAdvisor({
      envelope,
      qualityProfile: profile
    });

    const advice = advisor.analyze({
      metrics: { frameMs: 40, cpuMs: 22, memoryMB: 900, netKbps: 180 },
      capabilityAtlas: { summary: { coverageScore: 96, p0GapCount: 0 } }
    });

    expect(advice).toMatchObject({
      status: 'degrade',
      bottleneck: 'cpu',
      gates: {
        capabilityCoverage: 'pass'
      }
    });
    expect(advice.actions).toEqual([
      'deferNonCriticalJobs',
      'reduceSimulationRate',
      'tightenTexturePool',
      'lowerNetworkSnapshotRate',
      'reduceParticleDensity',
      'reduceTextureResolution',
      'reduceNetSnapshotRate'
    ]);
  });
});
