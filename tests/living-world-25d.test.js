import { describe, expect, it } from 'vitest';
import {
  SocialAwareness25D,
  WorldMemory25D
} from '../src/index.js';

describe('OmniCore 2.5D Living World runtime', () => {
  it('creates deterministic proximity greetings for friendly NPCs', () => {
    const social = new SocialAwareness25D({ greetingRadius: 36 });
    const decisions = social.evaluate({
      npcs: [
        { id: 'merchant', x: 10, y: 10, tags: ['friendly'], animationSet: { greet: 'nod' } },
        { id: 'guard', x: 32, y: 12, tags: ['friendly'] },
        { id: 'bandit', x: 18, y: 10, tags: ['hostile'] }
      ]
    });

    expect(decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'greet',
        actorId: 'merchant',
        targetId: 'guard',
        animation: 'nod',
        reason: 'proximity:friendly'
      })
    ]));
    expect(decisions.some((decision) => decision.targetId === 'bandit')).toBe(false);
  });

  it('assigns stable queue slots at a shop location', () => {
    const social = new SocialAwareness25D();
    const decisions = social.evaluate({
      npcs: [
        { id: 'villager-b', x: 0, y: 0, wants: ['shop'] },
        { id: 'villager-a', x: 0, y: 0, wants: ['shop'] }
      ],
      locations: [
        { id: 'shop-counter', type: 'shop', x: 96, y: 128, queueDirection: { x: 0, y: 18 } }
      ]
    });

    const queue = decisions.filter((decision) => decision.type === 'queue');
    expect(queue.map((decision) => decision.actorId)).toEqual(['villager-a', 'villager-b']);
    expect(queue.map((decision) => decision.slot)).toEqual([0, 1]);
    expect(queue[1].position).toMatchObject({ x: 96, y: 146, z: 0 });
  });

  it('routes shelter-seeking NPCs to the closest awning when raining', () => {
    const social = new SocialAwareness25D();
    const decisions = social.evaluate({
      weather: { type: 'rain', intensity: 0.8 },
      npcs: [
        { id: 'child', x: 80, y: 100, needsShelter: true }
      ],
      locations: [
        { id: 'awning-west', type: 'shelter', x: 0, y: 0 },
        { id: 'awning-east', type: 'shelter', x: 96, y: 112 }
      ]
    });

    expect(decisions).toEqual([expect.objectContaining({
      type: 'shelter',
      actorId: 'child',
      locationId: 'awning-east',
      groupId: 'rain-shelter:awning-east'
    })]);
  });

  it('resolves boss defeat memory into a permanent building scar patch', () => {
    const memory = new WorldMemory25D();
    memory.record({
      type: 'boss-defeated',
      id: 'boss-market-square',
      actorId: 'hero',
      locationId: 'blacksmith',
      tags: ['combat', 'public'],
      at: 1000
    });

    const patches = memory.resolveScenePatches({
      entities: [{ id: 'blacksmith', type: 'dimension3d-model' }]
    });

    expect(patches).toEqual([expect.objectContaining({
      entityId: 'blacksmith',
      reason: 'memory:boss-defeated',
      patch: expect.objectContaining({
        variant: 'scarred',
        decals: expect.arrayContaining(['broken-window', 'smoke-stain'])
      })
    })]);
  });

  it('remembers skill use near an NPC and resolves a new dialogue branch', () => {
    const memory = new WorldMemory25D();
    memory.record({
      type: 'skill-used-nearby',
      id: 'fire-skill-market',
      actorId: 'hero',
      npcId: 'merchant',
      skillId: 'fire-wave',
      tags: ['public'],
      at: 1200
    });

    expect(memory.resolveDialogue('merchant')).toMatchObject({
      npcId: 'merchant',
      lineId: 'saw-fire-wave',
      reason: 'memory:skill-used-nearby'
    });
  });

  it('snapshots and restores bounded world memory', () => {
    const memory = new WorldMemory25D({ maxEvents: 2 });
    memory.record({ type: 'boss-defeated', id: 'old', locationId: 'old-house', at: 1 });
    memory.record({ type: 'boss-defeated', id: 'new-a', locationId: 'tower', at: 2 });
    memory.record({ type: 'boss-defeated', id: 'new-b', locationId: 'gate', at: 3 });

    const restored = new WorldMemory25D().restore(memory.snapshot());
    const snapshot = restored.snapshot();

    expect(snapshot.events.map((event) => event.id)).toEqual(['new-a', 'new-b']);
    expect(restored.resolveScenePatches({ entities: [{ id: 'tower' }, { id: 'gate' }] })).toHaveLength(2);
  });
});
