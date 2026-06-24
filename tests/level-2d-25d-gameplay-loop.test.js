import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LEVEL_2D_25D_GAMEPLAY_SCHEMA,
  createLevel2D25DGameplayLoop
} from '../src/index.js';

describe('2D/2.5D level gameplay loop', () => {
  it('runs camera zones, combat, collectibles, checkpoints, patrols, events, y-sort, budgets, and debug payloads', () => {
    const loop = createLevel2D25DGameplayLoop({
      delta: 0.5,
      world: { bounds: { x: 0, y: 0, width: 320, height: 180 }, frameBudgetMs: 16.67 },
      camera: {
        target: 'hero',
        viewport: { width: 160, height: 96 },
        zones: [
          { id: 'room-a', x: 0, y: 0, width: 160, height: 96, deadzone: { x: 48, y: 24, width: 64, height: 40 } },
          { id: 'room-b', x: 160, y: 0, width: 160, height: 96, transition: 'fade' }
        ]
      },
      actors: [
        {
          id: 'hero',
          type: 'player',
          x: 32,
          y: 44,
          width: 16,
          height: 24,
          health: 10,
          facing: 'right',
          state: { attacking: true },
          hitboxes: [{ id: 'sword', x: 14, y: 4, width: 24, height: 12, damage: 3, tags: ['melee'] }],
          hurtboxes: [{ id: 'body', x: 0, y: 0, width: 16, height: 24 }]
        },
        {
          id: 'slime',
          type: 'enemy',
          x: 58,
          y: 46,
          width: 18,
          height: 18,
          health: 5,
          patrol: { from: 48, to: 96, speed: 20, direction: 1 },
          hurtboxes: [{ id: 'body', x: 0, y: 0, width: 18, height: 18 }]
        }
      ],
      collectibles: [
        { id: 'coin-1', x: 34, y: 50, width: 10, height: 10, inventoryKey: 'coins', value: 1 }
      ],
      checkpoints: [
        { id: 'cp-1', x: 24, y: 38, width: 24, height: 32, respawn: { x: 28, y: 36 } }
      ],
      triggers: [
        { id: 'door-a', x: 40, y: 40, width: 18, height: 28, event: 'scene:transition', target: 'room-b' }
      ],
      render: { visibleBounds: { x: 0, y: 0, width: 160, height: 96 }, maxDrawCalls: 12 }
    });

    expect(loop.schema).toBe(LEVEL_2D_25D_GAMEPLAY_SCHEMA);
    expect(loop.camera).toMatchObject({
      followTargetId: 'hero',
      activeZoneId: 'room-a',
      view: { x: 0, y: 0, width: 160, height: 96 }
    });
    expect(loop.camera.deadzone).toMatchObject({ width: 64, height: 40 });
    expect(loop.combat.damageEvents).toEqual([
      expect.objectContaining({
        attackerId: 'hero',
        targetId: 'slime',
        hitboxId: 'sword',
        damage: 3
      })
    ]);
    expect(loop.combat.healthUpdates.slime).toMatchObject({ previous: 5, current: 2 });
    expect(loop.collectibles.events).toEqual([
      expect.objectContaining({ actorId: 'hero', collectibleId: 'coin-1', inventoryKey: 'coins', value: 1 })
    ]);
    expect(loop.collectibles.inventoryDelta).toEqual({ coins: 1 });
    expect(loop.collectibles.collectedIds).toContain('coin-1');
    expect(loop.checkpoints.activeCheckpointId).toBe('cp-1');
    expect(loop.checkpoints.respawnPoint).toEqual({ x: 28, y: 36 });
    expect(loop.enemyAI.patrolUpdates).toEqual([
      expect.objectContaining({ actorId: 'slime', fromX: 58, nextX: 68, direction: 1 })
    ]);
    expect(loop.events.queue).toEqual([
      expect.objectContaining({ id: 'door-a', type: 'scene:transition', target: 'room-b', actorId: 'hero' })
    ]);
    expect(loop.render.ySortQueue.map((item) => item.id)).toEqual(expect.arrayContaining([
      'hero',
      'slime',
      'cp-1',
      'door-a'
    ]));
    expect(loop.render.ySortQueue.map((item) => item.id)).not.toContain('coin-1');
    expect(loop.performance.frameBudget).toMatchObject({
      budgetMs: 16.67,
      overBudget: false
    });
    expect(loop.editor.panels).toEqual(expect.arrayContaining([
      'CameraZones',
      'Combat',
      'Collectibles',
      'Checkpoints',
      'EnemyAI',
      'Events',
      'YSort',
      'FrameBudget'
    ]));
    expect(loop.runtimeSync.payloads).toEqual(expect.arrayContaining([
      'camera',
      'combat',
      'collectibles',
      'checkpoints',
      'enemyAI',
      'events',
      'render',
      'performance'
    ]));
    expect(loop.debugDraw.map((command) => command.op)).toEqual(expect.arrayContaining([
      'debug:camera-zone',
      'debug:hitbox',
      'debug:hurtbox',
      'debug:collectible',
      'debug:checkpoint',
      'debug:patrol-path',
      'debug:y-sort-entry'
    ]));
    expect(loop.quality.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'camera-zone-follow', pass: true }),
      expect.objectContaining({ id: 'combat-hitbox-hurtbox', pass: true }),
      expect.objectContaining({ id: 'collectible-pickup', pass: true }),
      expect.objectContaining({ id: 'checkpoint-respawn', pass: true }),
      expect.objectContaining({ id: 'enemy-patrol-ai', pass: true }),
      expect.objectContaining({ id: 'frame-budget', pass: true })
    ]));
  });

  it('is wired into the official 2D/2.5D platformer demo', () => {
    const root = join(process.cwd(), 'examples/2d-25d-platformer-demo');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    const readme = readFileSync(join(root, 'README.md'), 'utf8');

    expect(main).toContain('createLevel2D25DGameplayLoop');
    expect(main).toContain('CameraZones');
    expect(main).toContain('FrameBudget');
    expect(main).toContain('checkpoint');
    expect(main).toContain('patrol');
    expect(readme).toContain('camera zones');
    expect(readme).toContain('combat');
    expect(readme).toContain('collectibles');
    expect(readme).toContain('checkpoints');
    expect(readme).toContain('frame budget');
  });
});
