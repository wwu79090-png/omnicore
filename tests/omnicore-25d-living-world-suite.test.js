import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createEditorDeployBenchmark25D,
  EditorCoCreator25D,
  EmotionalPalette25D,
  WorldMemory25D
} from '../src/index.js';

describe('OmniCore 2.5D living world integration suite', () => {
  it('combines remembered boss defeat with dialogue and emotional palette descriptors', () => {
    const memory = new WorldMemory25D();
    memory.record({ type: 'boss-defeated', id: 'boss', locationId: 'blacksmith', npcId: 'merchant', at: 1 });
    const dialogue = memory.resolveDialogue('merchant', { fallback: '欢迎回来。' });
    const palette = new EmotionalPalette25D().resolve({ mood: 'safe', intensity: 0.6 });

    expect(dialogue.reason).toMatch(/^memory:/);
    expect(palette.pipeline).toBe('omnicore-25d-emotional-palette/v1');
  });

  it('turns a co-created tower plan into a memory scene patch descriptor', () => {
    const plan = new EditorCoCreator25D().plan({
      prompt: '在树林后建一个高塔，塔顶有一把剑',
      scene: { entities: [{ id: 'forest', type: 'forest', x: 80, y: 120 }] }
    });
    const memory = new WorldMemory25D();
    memory.record({ type: 'cocreation-applied', id: 'tower-plan', plan, locationId: 'forest-tower', at: 1 });

    expect(memory.resolveScenePatches({ entities: [{ id: 'forest-tower' }] })[0]).toMatchObject({
      entityId: 'forest-tower',
      reason: 'memory:cocreation-applied'
    });
  });

  it('documents deterministic living-world APIs and opt-in sensors', () => {
    expect(existsSync('docs/25d-living-world.md')).toBe(true);
    const docs = readFileSync('docs/25d-living-world.md', 'utf8');
    expect(docs).toContain('SocialAwareness25D');
    expect(docs).toContain('WorldMemory25D');
    expect(docs).toContain('EmotionalPalette25D');
    expect(docs).toContain('RealitySensor25D');
    expect(docs).toContain('EditorCoCreator25D');
    expect(docs).toContain('权限');
  });

  it('ships official 2.5D editor deploy demo and benchmark evidence', () => {
    expect(existsSync('examples/25d-editor-deploy-loop.json')).toBe(true);
    const demo = JSON.parse(readFileSync('examples/25d-editor-deploy-loop.json', 'utf8'));
    const evidence = createEditorDeployBenchmark25D({
      demo,
      deployment: {
        manifest: {
          profile: '2.5d-editor-lite',
          targets: ['web'],
          scenes: 1,
          assets: 2,
          coCreationPlans: 1
        },
        files: [
          { path: 'scenes/forest-demo.scene.json', data: {} },
          { path: 'manifests/deploy-lite.json', data: {} },
          { path: 'plans/25d-cocreation/forest-tower.json', data: {} }
        ]
      },
      readiness: { ready: true, score: 100 }
    });

    expect(demo.workflow).toEqual(['plan', 'apply', 'save', 'export', 'readiness']);
    expect(evidence).toMatchObject({
      format: 'OmniCore.EditorDeployBenchmark25D',
      ready: true,
      score: expect.any(Number),
      stages: [
        expect.objectContaining({ id: 'plan', status: 'pass' }),
        expect.objectContaining({ id: 'apply', status: 'pass' }),
        expect.objectContaining({ id: 'save', status: 'pass' }),
        expect.objectContaining({ id: 'export', status: 'pass' }),
        expect.objectContaining({ id: 'readiness', status: 'pass' })
      ],
      budget: {
        profile: '2.5d-editor-lite',
        maxFiles: 12,
        fileCount: 3
      }
    });
    expect(evidence.score).toBeGreaterThanOrEqual(95);
  });
});
