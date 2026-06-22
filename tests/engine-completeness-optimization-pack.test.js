import { describe, expect, it } from 'vitest';
import {
  CompletenessClosurePlanner,
  CompletenessGapAnalyzer,
  EngineCompletenessMatrix
} from '../src/index.js';

describe('engine completeness optimization pack', () => {
  it('scores domain completeness across lifecycle stages and required capabilities', () => {
    const matrix = new EngineCompletenessMatrix({
      requiredStages: ['runtime', 'authoring', 'tests', 'docs', 'release']
    });

    const report = matrix.evaluate({
      minimumScore: 80,
      domains: [
        {
          id: 'renderer',
          stages: { runtime: true, authoring: true, tests: true, docs: true, release: false },
          requiredCapabilities: ['webgl', 'canvas', 'batching', 'fallback'],
          capabilities: ['webgl', 'canvas', 'batching']
        },
        {
          id: 'netcode',
          stages: { runtime: true, authoring: false, tests: true, docs: false, release: false },
          requiredCapabilities: ['snapshot', 'rollback', 'interest'],
          capabilities: ['snapshot']
        }
      ]
    });

    expect(report.summary).toEqual({
      domainCount: 2,
      requiredStageCount: 10,
      coveredStageCount: 6,
      requiredCapabilityCount: 7,
      coveredCapabilityCount: 4,
      score: 58,
      ready: false
    });
    expect(report.domains.map((domain) => [domain.id, domain.score])).toEqual([
      ['renderer', 78],
      ['netcode', 37]
    ]);
    expect(report.gaps).toEqual([
      { domain: 'netcode', type: 'stage', id: 'authoring', severity: 'P0' },
      { domain: 'netcode', type: 'stage', id: 'docs', severity: 'P0' },
      { domain: 'netcode', type: 'stage', id: 'release', severity: 'P0' },
      { domain: 'netcode', type: 'capability', id: 'rollback', severity: 'P0' },
      { domain: 'netcode', type: 'capability', id: 'interest', severity: 'P0' },
      { domain: 'renderer', type: 'stage', id: 'release', severity: 'P1' },
      { domain: 'renderer', type: 'capability', id: 'fallback', severity: 'P1' }
    ]);
  });

  it('audits API, docs, tests, examples, and production evidence for each feature', () => {
    const analyzer = new CompletenessGapAnalyzer({
      requiredEvidence: { api: 2, docs: 1, tests: 1, examples: 1, production: 2 }
    });

    const report = analyzer.analyze([
      {
        id: 'asset-pipeline',
        api: ['AddressableCatalog', 'AssetResidencyManager'],
        docs: ['docs/assets.md'],
        tests: ['tests/build-asset-pipeline.test.js'],
        examples: [],
        production: ['import', 'pack']
      },
      {
        id: 'platform-export',
        api: ['ExportPreset'],
        docs: [],
        tests: [],
        examples: [],
        production: ['web']
      }
    ]);

    expect(report.summary).toEqual({
      featureCount: 2,
      issueCount: 6,
      ready: false
    });
    expect(report.issues).toEqual([
      { feature: 'platform-export', type: 'tests', missing: 1, severity: 'P0' },
      { feature: 'asset-pipeline', type: 'examples', missing: 1, severity: 'P1' },
      { feature: 'platform-export', type: 'api', missing: 1, severity: 'P1' },
      { feature: 'platform-export', type: 'docs', missing: 1, severity: 'P1' },
      { feature: 'platform-export', type: 'examples', missing: 1, severity: 'P1' },
      { feature: 'platform-export', type: 'production', missing: 1, severity: 'P1' }
    ]);
    expect(report.recommendations).toEqual([
      'addTests:platform-export',
      'addExamples:asset-pipeline',
      'expandApi:platform-export',
      'addDocs:platform-export',
      'addExamples:platform-export',
      'addProductionProof:platform-export'
    ]);
  });

  it('plans completeness closure steps with verification commands', () => {
    const planner = new CompletenessClosurePlanner();
    const plan = planner.plan({
      matrix: {
        gaps: [
          { domain: 'netcode', type: 'stage', id: 'release', severity: 'P0' },
          { domain: 'renderer', type: 'capability', id: 'fallback', severity: 'P1' }
        ]
      },
      evidence: {
        issues: [
          { feature: 'platform-export', type: 'tests', missing: 1, severity: 'P0' },
          { feature: 'asset-pipeline', type: 'examples', missing: 1, severity: 'P1' }
        ]
      }
    });

    expect(plan.summary).toEqual({
      stepCount: 4,
      p0Count: 2,
      p1Count: 2,
      estimatedClosure: 42
    });
    expect(plan.steps).toEqual([
      {
        id: 'netcode:close-stage-release',
        area: 'netcode',
        priority: 'P0',
        action: 'close-stage-release',
        reason: 'stage-gap',
        verification: 'npm test -- tests/engine-pattern-netcode-resilience-pack.test.js'
      },
      {
        id: 'platform-export:add-tests',
        area: 'platform-export',
        priority: 'P0',
        action: 'add-tests',
        reason: 'evidence-gap',
        verification: 'npm test -- tests/engine-pattern-platform-pack.test.js'
      },
      {
        id: 'renderer:close-capability-fallback',
        area: 'renderer',
        priority: 'P1',
        action: 'close-capability-fallback',
        reason: 'capability-gap',
        verification: 'npm test -- tests/renderer-backends-mvp.test.js'
      },
      {
        id: 'asset-pipeline:add-examples',
        area: 'asset-pipeline',
        priority: 'P1',
        action: 'add-examples',
        reason: 'evidence-gap',
        verification: 'npm test -- tests/build-asset-pipeline.test.js'
      }
    ]);
  });
});
