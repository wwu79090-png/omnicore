import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PROJECTILE_2D_25D_SCHEMA,
  createProjectile2D25DDirectorStep
} from '../src/index.js';

describe('2D/2.5D projectile director', () => {
  it('coordinates emitters, projectile motion, collisions, pierce, bounce, pooling, feedback, debug, editor, and runtime sync', () => {
    const step = createProjectile2D25DDirectorStep({
      delta: 0.5,
      bounds: { x: 0, y: 0, width: 320, height: 180 },
      emitters: [
        {
          id: 'hero-blaster',
          ownerId: 'hero',
          prefab: 'bolt',
          fire: true,
          muzzle: { x: 40, y: 72 },
          direction: { x: 1, y: 0 },
          speed: 120,
          damage: 2,
          pierce: 1,
          poolSize: 8,
          cooldownMs: 0
        }
      ],
      projectiles: [
        {
          id: 'bolt-live',
          ownerId: 'hero',
          prefab: 'bolt',
          x: 82,
          y: 72,
          width: 8,
          height: 4,
          velocity: { x: 120, y: 0 },
          damage: 2,
          pierce: 1,
          ageMs: 120,
          ttlMs: 1000
        },
        {
          id: 'enemy-shot',
          ownerId: 'slime',
          prefab: 'spit',
          x: 292,
          y: 32,
          width: 8,
          height: 8,
          velocity: { x: 80, y: 0 },
          damage: 1,
          bounce: 1,
          ageMs: 80,
          ttlMs: 1000
        }
      ],
      targets: [
        {
          id: 'slime',
          type: 'enemy',
          x: 136,
          y: 68,
          width: 20,
          height: 20,
          health: 4,
          hurtboxes: [{ id: 'body', x: 0, y: 0, width: 20, height: 20 }]
        },
        { id: 'crate', type: 'prop', x: 188, y: 70, width: 18, height: 18, health: 3 }
      ],
      colliders: [
        { id: 'right-wall', type: 'solid', x: 300, y: 0, width: 8, height: 180 }
      ],
      pool: { budget: 10, active: 2 }
    });

    expect(step.schema).toBe(PROJECTILE_2D_25D_SCHEMA);
    expect(step.spawning.spawnCommands).toEqual([
      expect.objectContaining({
        emitterId: 'hero-blaster',
        prefab: 'bolt',
        x: 40,
        y: 72,
        velocity: { x: 120, y: 0 }
      })
    ]);
    expect(step.motion.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'bolt-live', x: 142, y: 72, ageMs: 620 }),
      expect.objectContaining({ id: 'enemy-shot', x: 292, y: 32, velocity: { x: -80, y: 0 }, bounced: true })
    ]));
    expect(step.collisions.hitEvents).toEqual([
      expect.objectContaining({ projectileId: 'bolt-live', targetId: 'slime', damage: 2 })
    ]);
    expect(step.collisions.pierceUpdates).toEqual([
      expect.objectContaining({ projectileId: 'bolt-live', remainingPierce: 0 })
    ]);
    expect(step.lifetime.despawnCommands).toEqual([]);
    expect(step.pool).toMatchObject({ budget: 10, active: 3, available: 7, overBudget: false });
    expect(step.feedback).toMatchObject({
      impactParticles: [expect.objectContaining({ targetId: 'slime', preset: 'projectile-impact' })],
      audioCues: [expect.objectContaining({ cue: 'projectile-hit', targetId: 'slime' })]
    });
    expect(step.editor.panels).toEqual(expect.arrayContaining([
      'ProjectileDirector',
      'Emitters',
      'ProjectilePool',
      'Hitboxes',
      'PierceBounce',
      'TrajectoryDebug',
      'RuntimeDebug'
    ]));
    expect(step.runtimeSync.payloads).toEqual(expect.arrayContaining([
      'spawning',
      'motion',
      'collisions',
      'lifetime',
      'pool',
      'feedback'
    ]));
    expect(step.debugDraw.map((command) => command.op)).toEqual(expect.arrayContaining([
      'debug:projectile-trajectory',
      'debug:projectile-hitbox',
      'debug:projectile-impact',
      'debug:projectile-pool'
    ]));
    expect(step.quality.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'projectile-spawn', pass: true }),
      expect.objectContaining({ id: 'projectile-motion', pass: true }),
      expect.objectContaining({ id: 'projectile-collision', pass: true }),
      expect.objectContaining({ id: 'projectile-pool-budget', pass: true }),
      expect.objectContaining({ id: 'editor-runtime-projectile-sync', pass: true })
    ]));
  });

  it('is wired into the official 2D/2.5D platformer demo', () => {
    const root = join(process.cwd(), 'examples/2d-25d-platformer-demo');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    const readme = readFileSync(join(root, 'README.md'), 'utf8');

    expect(main).toContain('createProjectile2D25DDirectorStep');
    expect(main).toContain('ProjectileDirector');
    expect(main).toContain('ProjectilePool');
    expect(main).toContain('PierceBounce');
    expect(readme).toContain('projectile director');
    expect(readme).toContain('projectile pool');
    expect(readme).toContain('pierce and bounce');
  });
});
