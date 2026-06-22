import { describe, expect, it } from 'vitest';
import {
  PerformanceRegressionGuard,
  RuntimeOptimizationController,
  ScalabilityTierMatrix,
  ThermalPowerGovernor
} from '../src/index.js';

describe('engine pattern extreme runtime control pack', () => {
  it('plans deterministic Unreal-style scalability tier transitions', () => {
    const matrix = new ScalabilityTierMatrix({
      tiers: {
        high: { renderScale: 1, shadowQuality: 3, textureQuality: 3, effectsQuality: 3 },
        low: { renderScale: 0.65, shadowQuality: 0, textureQuality: 1, effectsQuality: 0 }
      }
    });

    expect(matrix.planTransition('high', 'low')).toEqual({
      from: 'high',
      to: 'low',
      changed: [
        { setting: 'effectsQuality', from: 3, to: 0 },
        { setting: 'renderScale', from: 1, to: 0.65 },
        { setting: 'shadowQuality', from: 3, to: 0 },
        { setting: 'textureQuality', from: 3, to: 1 }
      ],
      appliedSettings: {
        effectsQuality: 0,
        renderScale: 0.65,
        shadowQuality: 0,
        textureQuality: 1
      }
    });
    expect(matrix.resolveTier('low')).toMatchObject({ renderScale: 0.65 });
  });

  it('applies runtime optimization actions and rolls them back without losing original state', () => {
    const renderer = { renderScale: 1, particleDensity: 1, textureResolution: 3 };
    const network = { snapshotRate: 30 };
    const scheduler = { deferNonCriticalJobs: false };
    const controller = new RuntimeOptimizationController({
      targets: { renderer, network, scheduler }
    });

    const result = controller.apply([
      'reduceRenderScale',
      'lowerNetworkSnapshotRate',
      'deferNonCriticalJobs',
      'reduceParticleDensity'
    ]);

    expect(result.applied).toEqual([
      'reduceRenderScale',
      'lowerNetworkSnapshotRate',
      'deferNonCriticalJobs',
      'reduceParticleDensity'
    ]);
    expect({ renderer, network, scheduler }).toEqual({
      renderer: { renderScale: 0.85, particleDensity: 0.5, textureResolution: 3 },
      network: { snapshotRate: 15 },
      scheduler: { deferNonCriticalJobs: true }
    });
    expect(controller.rollback()).toEqual({
      restored: true,
      targets: {
        renderer: { renderScale: 1, particleDensity: 1, textureResolution: 3 },
        network: { snapshotRate: 30 },
        scheduler: { deferNonCriticalJobs: false }
      }
    });
  });

  it('guards against performance regressions from historical baselines', () => {
    const guard = new PerformanceRegressionGuard({
      baselines: {
        fps: { value: 60, direction: 'higher', tolerance: 0.05 },
        frameMs: { value: 16.7, direction: 'lower', tolerance: 0.1 },
        memoryMB: { value: 400, direction: 'lower', tolerance: 0.15 }
      }
    });

    const report = guard.compare({ fps: 54, frameMs: 22, memoryMB: 430 });

    expect(report).toMatchObject({
      passed: false,
      primaryRegression: 'frameMs',
      score: expect.any(Number)
    });
    expect(report.regressions.map((item) => item.metric)).toEqual(['frameMs', 'fps']);
    expect(report.regressions[0]).toMatchObject({
      metric: 'frameMs',
      severity: 'critical',
      baseline: 16.7,
      current: 22,
      ratio: 1.317
    });
  });

  it('turns thermal, battery, and save-data constraints into hard runtime caps', () => {
    const governor = new ThermalPowerGovernor({ targetFps: 60, minFps: 30 });

    expect(governor.evaluate({
      thermalState: 'serious',
      batteryLevel: 0.12,
      lowPowerMode: true,
      pluggedIn: false,
      saveData: true
    })).toEqual({
      status: 'constrained',
      targetFps: 30,
      constraints: ['lowPowerMode', 'lowBattery', 'thermalSerious', 'saveData'],
      qualityBudget: {
        renderScale: 0.75,
        textureQuality: 0.5,
        backgroundEffects: false
      },
      actions: [
        'capFrameRate',
        'reduceTextureQuality',
        'disableBackgroundEffects',
        'lowerNetworkSnapshotRate'
      ]
    });
  });
});
