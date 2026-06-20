import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
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
});
