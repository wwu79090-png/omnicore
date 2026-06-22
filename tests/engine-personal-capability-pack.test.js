import { describe, expect, it } from 'vitest';
import {
  CreatorWorkflowCoach,
  PersonalCapabilityProfile,
  SoloProductionPlanner
} from '../src/index.js';

describe('engine personal capability pack', () => {
  it('scores solo creator abilities from project evidence and ranks weak spots', () => {
    const profile = new PersonalCapabilityProfile({
      abilities: {
        programming: { score: 82, evidence: ['ecs-tests', 'build-pass'] },
        artPipeline: { score: 38, evidence: ['missing-atlas-proof'] },
        gameDesign: { score: 55, evidence: ['prototype-loop'] },
        releaseOps: { score: 44, evidence: ['no-store-checklist'] }
      }
    });

    const report = profile.evaluate({
      target: 'ship-playable-demo',
      minimumScore: 60,
      weights: { releaseOps: 1.4 }
    });

    expect(report.summary).toMatchObject({
      target: 'ship-playable-demo',
      abilityCount: 4,
      ready: false
    });
    expect(report.summary.score).toBe(56);
    expect(report.weakest.map((item) => item.id)).toEqual(['releaseOps', 'artPipeline', 'gameDesign']);
    expect(report.recommendations).toEqual([
      'train:releaseOps',
      'train:artPipeline',
      'train:gameDesign'
    ]);
  });

  it('builds a direct coaching plan from weak abilities and engine gaps', () => {
    const coach = new CreatorWorkflowCoach({
      playbook: {
        artPipeline: ['create-asset-style-board', 'build-atlas-smoke-test'],
        releaseOps: ['run-release-readiness', 'write-platform-checklist'],
        performance: ['capture-frame-budget', 'reduce-hotspots']
      }
    });

    const plan = coach.plan({
      profile: {
        weakest: [
          { id: 'releaseOps', score: 44 },
          { id: 'artPipeline', score: 38 }
        ]
      },
      bottlenecks: [
        { area: 'performance', score: 7, drivers: ['frameMs', 'drawCalls'] }
      ],
      hoursAvailable: 3
    });

    expect(plan.summary).toMatchObject({
      focusCount: 3,
      hoursAvailable: 3,
      mode: 'solo-sprint'
    });
    expect(plan.steps.map((step) => step.id)).toEqual([
      'releaseOps:run-release-readiness',
      'artPipeline:create-asset-style-board',
      'performance:capture-frame-budget'
    ]);
    expect(plan.steps[0]).toMatchObject({
      priority: 'P0',
      verification: 'npm test -- tests/release-readiness.test.js'
    });
  });

  it('turns a solo project goal into a measurable production route', () => {
    const route = new SoloProductionPlanner().plan({
      goal: 'one-person-rpg-demo',
      scope: ['combat', 'dialogue', 'save', 'web-export'],
      risks: ['asset-volume', 'late-testing'],
      deadlineDays: 10
    });

    expect(route.summary).toMatchObject({
      goal: 'one-person-rpg-demo',
      deadlineDays: 10,
      phaseCount: 4,
      riskCount: 2
    });
    expect(route.phases.map((phase) => phase.id)).toEqual([
      'prototype',
      'content-slice',
      'quality-pass',
      'release'
    ]);
    expect(route.checkpoints).toEqual([
      'playable-loop-by-day-2',
      'content-slice-by-day-5',
      'quality-gate-by-day-8',
      'release-candidate-by-day-10'
    ]);
    expect(route.riskMitigations).toEqual([
      { risk: 'asset-volume', mitigation: 'lock-style-and-atlas-budget' },
      { risk: 'late-testing', mitigation: 'run-daily-smoke-and-save-replay' }
    ]);
  });
});
