import { describe, expect, it } from 'vitest';
import {
  EngineCommercialClosureGate,
  createEngineCommercialClosureReport
} from '../src/index.js';

describe('engine commercial closure gate', () => {
  it('turns scattered completeness and quality signals into a commercial release gate', () => {
    const report = createEngineCommercialClosureReport({
      minimumCompletenessScore: 90,
      minimumQualityScore: 80,
      domains: [
        {
          id: '2d-editor',
          stages: { runtime: true, authoring: true, tests: true, docs: true, release: true },
          requiredCapabilities: ['tilemap', 'prefab-stamp', 'playtest'],
          capabilities: ['tilemap', 'prefab-stamp', 'playtest']
        },
        {
          id: '3d-runtime',
          stages: { runtime: true, authoring: true, tests: true, docs: false, release: false },
          requiredCapabilities: ['gltf', 'camera', 'lighting', 'rapier-debug'],
          capabilities: ['gltf', 'camera', 'lighting']
        }
      ],
      features: [
        {
          id: 'exe-launcher',
          scores: { usability: 92, reliability: 88, performance: 84, maintainability: 80 },
          evidence: { desktopTest: true }
        },
        {
          id: 'webgpu-pipeline',
          scores: { usability: 78, reliability: 68, performance: 82, maintainability: 75 },
          evidence: { hardwareReport: false }
        }
      ],
      limits: [
        { id: 'webgpu-device-lost', area: 'renderer', kind: 'hard', status: 'active' }
      ],
      evidence: {
        issues: [
          { feature: '3d-runtime', type: 'docs', severity: 'P1' },
          { feature: 'webgpu-pipeline', type: 'tests', severity: 'P0' }
        ]
      },
      production: {
        goal: 'commercial-game-template',
        scope: ['2d-editor', '3d-runtime', 'webgpu-pipeline', 'platform-export'],
        risks: ['asset-scope', 'performance-regression'],
        deadlineDays: 21
      }
    });

    expect(report.generatedBy).toBe('OmniCore commercial closure gate');
    expect(report.summary).toMatchObject({
      commercialReady: false,
      status: 'blocked',
      domainCount: 2,
      featureCount: 2,
      hardLimitCount: 1
    });
    expect(report.summary.blockerCount).toBeGreaterThanOrEqual(6);
    expect(report.gates.completeness.ready).toBe(false);
    expect(report.gates.quality.ready).toBe(false);
    expect(report.gates.limits.ready).toBe(false);
    expect(report.gates.evidence.ready).toBe(false);
    expect(report.connectedLoops).toEqual([
      'completeness-matrix',
      'closure-plan',
      'function-quality',
      'limit-removal',
      'production-plan',
      'editor-next-actions',
      'release-gate'
    ]);

    expect(report.blockers[0].priority).toBe('P0');
    expect(report.blockers.map((blocker) => blocker.source)).toEqual(expect.arrayContaining([
      'completeness',
      'quality',
      'limit',
      'evidence'
    ]));
    expect(report.releaseGate.requiredActions).toEqual(expect.arrayContaining([
      '3d-runtime:close-stage-docs',
      'webgpu-device-lost',
      'improve:webgpu-pipeline:reliability',
      'webgpu-pipeline:add-tests'
    ]));
    expect(report.releaseGate.verificationCommands).toEqual(expect.arrayContaining([
      'npm run benchmark:ci',
      'npm test -- tests/engine-completeness-optimization-pack.test.js',
      'npm test -- tests/engine-commercial-closure-gate.test.js'
    ]));
    expect(report.editorNextActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ command: 'quality-gate', reason: 'release-gate-blocked' }),
      expect.objectContaining({ command: 'webgpu-diagnostics', area: 'renderer' }),
      expect.objectContaining({ command: 'scene-3d-demo', area: '3d-runtime' })
    ]));
    expect(report.productionPlan.checkpoints).toContain('release-candidate-by-day-21');
  });

  it('marks the release gate ready when completeness quality evidence and limits are closed', () => {
    const gate = new EngineCommercialClosureGate({ minimumCompletenessScore: 80, minimumQualityScore: 75 });
    const report = gate.evaluate({
      domains: [
        {
          id: '2d-platformer',
          stages: { runtime: true, authoring: true, tests: true, docs: true, release: true },
          requiredCapabilities: ['tilemap', 'arcade-physics'],
          capabilities: ['tilemap', 'arcade-physics']
        }
      ],
      features: [
        {
          id: 'platformer-template',
          scores: { usability: 90, reliability: 88, performance: 86, maintainability: 84 },
          evidence: { e2e: true }
        }
      ],
      limits: [{ id: 'sprite-budget', area: 'renderer', kind: 'soft', status: 'lifted' }],
      evidence: { issues: [] },
      production: { goal: 'ship-platformer-template', scope: ['2d-platformer'], risks: [], deadlineDays: 7 }
    });

    expect(report.summary).toMatchObject({
      commercialReady: true,
      status: 'release-candidate',
      blockerCount: 0
    });
    expect(report.releaseGate.requiredActions).toEqual([]);
    expect(report.releaseGate.verificationCommands).toEqual([]);
    expect(report.editorNextActions).toEqual([
      { command: 'release-check', reason: 'release-candidate-ready', area: 'commercial' }
    ]);
  });
});
