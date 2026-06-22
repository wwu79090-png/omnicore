import { describe, expect, it } from 'vitest';
import {
  EngineFunctionQualityMatrix,
  FeatureQualityAuditor,
  QualityOptimizationPlanner
} from '../src/index.js';

describe('engine function quality optimization pack', () => {
  it('scores feature quality across usability, reliability, performance, and maintainability', () => {
    const matrix = new EngineFunctionQualityMatrix({
      dimensions: {
        usability: { weight: 1.2 },
        reliability: { weight: 1.5 },
        performance: { weight: 1.3 },
        maintainability: { weight: 1 }
      }
    });

    const report = matrix.evaluate({
      minimumScore: 70,
      features: [
        {
          id: 'renderer',
          scores: { usability: 70, reliability: 65, performance: 82, maintainability: 60 },
          evidence: { tests: true, docs: true, benchmark: true }
        },
        {
          id: 'asset-pipeline',
          scores: { usability: 45, reliability: 72, performance: 58, maintainability: 55 },
          evidence: { tests: true, docs: false, benchmark: false }
        }
      ]
    });

    expect(report.summary).toMatchObject({
      featureCount: 2,
      dimensionCount: 4,
      score: 64,
      ready: false
    });
    expect(report.features.map((feature) => [feature.id, feature.score])).toEqual([
      ['renderer', 70],
      ['asset-pipeline', 58]
    ]);
    expect(report.atRiskFeatures.map((feature) => feature.id)).toEqual(['asset-pipeline']);
    expect(report.recommendations).toEqual([
      'improve:asset-pipeline:usability',
      'improve:asset-pipeline:maintainability',
      'improve:asset-pipeline:performance'
    ]);
  });

  it('audits functional evidence instead of trusting feature names', () => {
    const auditor = new FeatureQualityAuditor({
      requiredEvidence: ['tests', 'docs', 'examples']
    });

    const report = auditor.audit([
      {
        id: 'scene',
        owner: 'core',
        evidence: { tests: true, docs: true, examples: true },
        api: ['Scene', 'SceneManager'],
        failureModes: ['load-fail'],
        smoke: 'npm test -- tests/core-systems.test.js'
      },
      {
        id: 'netcode',
        evidence: { tests: true, docs: false, examples: false },
        api: ['NetworkSnapshotBuffer'],
        failureModes: [],
        smoke: 'npm test -- tests/engine-pattern-netcode-resilience-pack.test.js'
      }
    ]);

    expect(report.summary).toMatchObject({
      featureCount: 2,
      issueCount: 4,
      ready: false
    });
    expect(report.issues).toEqual([
      { feature: 'netcode', code: 'missing-docs', severity: 'P1', message: 'netcode is missing docs evidence.' },
      { feature: 'netcode', code: 'missing-owner', severity: 'P1', message: 'netcode has no owner.' },
      { feature: 'netcode', code: 'missing-failure-modes', severity: 'P1', message: 'netcode has no failure-mode coverage.' },
      { feature: 'netcode', code: 'missing-examples', severity: 'P2', message: 'netcode is missing examples evidence.' }
    ]);
    expect(report.recommendations).toEqual([
      'document:netcode',
      'assignOwner:netcode',
      'addFailureModeTests:netcode',
      'addExample:netcode'
    ]);
  });

  it('turns quality scores and audit issues into prioritized optimization steps', () => {
    const planner = new QualityOptimizationPlanner();

    const plan = planner.plan({
      matrix: {
        features: [
          {
            id: 'asset-pipeline',
            score: 58,
            weakDimensions: [
              { dimension: 'usability', gap: 25 },
              { dimension: 'performance', gap: 12 }
            ]
          }
        ]
      },
      audit: {
        issues: [
          { feature: 'netcode', code: 'missing-owner', severity: 'P1' },
          { feature: 'netcode', code: 'missing-failure-modes', severity: 'P1' }
        ]
      }
    });

    expect(plan.summary).toEqual({
      stepCount: 4,
      p0Count: 2,
      p1Count: 2,
      estimatedImpact: 61
    });
    expect(plan.steps).toEqual([
      {
        id: 'asset-pipeline:raise-usability',
        feature: 'asset-pipeline',
        priority: 'P0',
        action: 'raise-usability',
        reason: 'quality-gap',
        verification: 'npm test -- tests/build-asset-pipeline.test.js'
      },
      {
        id: 'netcode:addFailureModeTests',
        feature: 'netcode',
        priority: 'P0',
        action: 'addFailureModeTests',
        reason: 'missing-failure-modes',
        verification: 'npm test -- tests/engine-pattern-netcode-resilience-pack.test.js'
      },
      {
        id: 'asset-pipeline:raise-performance',
        feature: 'asset-pipeline',
        priority: 'P1',
        action: 'raise-performance',
        reason: 'quality-gap',
        verification: 'npm test -- tests/build-asset-pipeline.test.js'
      },
      {
        id: 'netcode:assignOwner',
        feature: 'netcode',
        priority: 'P1',
        action: 'assignOwner',
        reason: 'missing-owner',
        verification: 'npm test -- tests/engine-pattern-netcode-resilience-pack.test.js'
      }
    ]);
  });
});
