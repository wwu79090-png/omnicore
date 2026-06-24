import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COLLECTIBLE_2D_25D_SCHEMA,
  createCollectible2D25DDirectorStep
} from '../src/index.js';

describe('2D/2.5D collectible director', () => {
  it('coordinates pickups, magnet attraction, drop spawns, inventory deltas, combo rewards, feedback, debug, editor, and runtime sync', () => {
    const step = createCollectible2D25DDirectorStep({
      delta: 0.25,
      actor: {
        id: 'hero',
        x: 100,
        y: 96,
        width: 20,
        height: 28,
        inventory: { coins: 1, keys: 0, xp: 0 },
        score: 200
      },
      magnet: {
        enabled: true,
        radius: 64,
        strength: 120
      },
      combo: {
        streak: 2,
        multiplier: 1.5,
        windowMs: 1200
      },
      collectibles: [
        {
          id: 'coin-near',
          type: 'coin',
          x: 108,
          y: 102,
          width: 10,
          height: 10,
          inventoryKey: 'coins',
          amount: 3,
          score: 100,
          pickupRadius: 18,
          feedback: { particle: 'coin-spark', audio: 'coin-pickup' }
        },
        {
          id: 'key-far',
          type: 'key',
          x: 152,
          y: 102,
          width: 10,
          height: 10,
          inventoryKey: 'keys',
          amount: 1,
          pickupRadius: 12,
          magnetizable: true
        },
        {
          id: 'xp-orb',
          type: 'xp',
          x: 94,
          y: 90,
          width: 8,
          height: 8,
          inventoryKey: 'xp',
          amount: 10,
          score: 25,
          pickupRadius: 28,
          magnetizable: true
        }
      ],
      dropSources: [
        {
          id: 'slime-a',
          defeated: true,
          x: 180,
          y: 104,
          drops: [
            { id: 'slime-coin', type: 'coin', inventoryKey: 'coins', amount: 2, chance: 1 }
          ]
        }
      ]
    });

    expect(step.schema).toBe(COLLECTIBLE_2D_25D_SCHEMA);
    expect(step.drops.spawnCommands).toEqual([
      expect.objectContaining({ sourceId: 'slime-a', collectibleId: 'slime-coin', type: 'coin', x: 180, y: 104 })
    ]);
    expect(step.magnet.targets).toEqual([
      expect.objectContaining({ collectibleId: 'key-far', actorId: 'hero', inRange: true })
    ]);
    expect(step.magnet.motionCommands).toEqual([
      expect.objectContaining({ collectibleId: 'key-far', velocity: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }) })
    ]);
    expect(step.pickups.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ collectibleId: 'coin-near', actorId: 'hero', inventoryKey: 'coins', amount: 3 }),
      expect.objectContaining({ collectibleId: 'xp-orb', actorId: 'hero', inventoryKey: 'xp', amount: 10 })
    ]));
    expect(step.inventory).toMatchObject({
      actorId: 'hero',
      deltas: [
        expect.objectContaining({ itemId: 'coins', amount: 3 }),
        expect.objectContaining({ itemId: 'xp', amount: 10 })
      ],
      totals: { coins: 4, keys: 0, xp: 10 }
    });
    expect(step.score).toMatchObject({
      base: 125,
      multiplier: 1.5,
      awarded: 188,
      total: 388
    });
    expect(step.combo).toMatchObject({
      previousStreak: 2,
      nextStreak: 4,
      multiplier: 1.5,
      refreshedMs: 1200
    });
    expect(step.lifetime.despawnCommands).toEqual(expect.arrayContaining([
      expect.objectContaining({ collectibleId: 'coin-near', reason: 'picked-up' }),
      expect.objectContaining({ collectibleId: 'xp-orb', reason: 'picked-up' })
    ]));
    expect(step.effects.applied).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'pickup-particle', preset: 'coin-spark', collectibleId: 'coin-near' }),
      expect.objectContaining({ type: 'pickup-audio', cue: 'coin-pickup', collectibleId: 'coin-near' }),
      expect.objectContaining({ type: 'hud-toast', text: '+3 coins' })
    ]));
    expect(step.events.queue).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'collectible:drop-spawn', sourceId: 'slime-a' }),
      expect.objectContaining({ type: 'collectible:pickup', collectibleId: 'coin-near' }),
      expect.objectContaining({ type: 'inventory:delta', itemId: 'coins', amount: 3 }),
      expect.objectContaining({ type: 'score:add', amount: 188 })
    ]));
    expect(step.editor.panels).toEqual(expect.arrayContaining([
      'CollectibleDirector',
      'PickupRules',
      'Magnet',
      'InventoryDeltas',
      'DropTables',
      'ComboRewards',
      'RuntimeDebug'
    ]));
    expect(step.runtimeSync.payloads).toEqual(expect.arrayContaining([
      'collectibles',
      'drops',
      'magnet',
      'pickups',
      'inventory',
      'combo',
      'effects',
      'events'
    ]));
    expect(step.debugDraw.map((command) => command.op)).toEqual(expect.arrayContaining([
      'debug:collectible-hitbox',
      'debug:collectible-magnet',
      'debug:collectible-pickup',
      'debug:inventory-delta'
    ]));
    expect(step.quality.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'collectible-pickup', pass: true }),
      expect.objectContaining({ id: 'collectible-magnet', pass: true }),
      expect.objectContaining({ id: 'drop-spawn', pass: true }),
      expect.objectContaining({ id: 'inventory-delta', pass: true }),
      expect.objectContaining({ id: 'editor-runtime-collectible-sync', pass: true })
    ]));
  });

  it('is wired into the official 2D/2.5D platformer demo', () => {
    const root = join(process.cwd(), 'examples/2d-25d-platformer-demo');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    const readme = readFileSync(join(root, 'README.md'), 'utf8');

    expect(main).toContain('createCollectible2D25DDirectorStep');
    expect(main).toContain('CollectibleDirector');
    expect(main).toContain('Magnet');
    expect(main).toContain('InventoryDeltas');
    expect(readme).toContain('collectible director');
    expect(readme).toContain('magnet pickup');
    expect(readme).toContain('inventory deltas');
  });
});
