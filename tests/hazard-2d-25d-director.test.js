import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HAZARD_2D_25D_SCHEMA,
  createHazard2D25DDirectorStep
} from '../src/index.js';

describe('2D/2.5D hazard director', () => {
  it('coordinates damage zones, moving hazards, knockback, invulnerability frames, respawn, events, editor, and runtime sync', () => {
    const step = createHazard2D25DDirectorStep({
      delta: 0.25,
      actor: {
        id: 'hero',
        x: 100,
        y: 96,
        width: 20,
        height: 28,
        health: 3,
        invulnerabilityMs: 0,
        velocity: { x: 24, y: 40 }
      },
      checkpoint: {
        id: 'checkpoint-hill',
        respawn: { x: 72, y: 178 }
      },
      hazards: [
        {
          id: 'spike-pit',
          type: 'spikes',
          x: 108,
          y: 114,
          width: 36,
          height: 16,
          damage: 1,
          knockback: { x: -180, y: -260 },
          invulnerabilityMs: 700,
          respawnOnHit: true,
          cooldownMs: 500
        },
        {
          id: 'moving-saw',
          type: 'moving-saw',
          x: 160,
          y: 96,
          width: 18,
          height: 18,
          damage: 1,
          path: { from: 150, to: 210, speed: 40, direction: 1 },
          knockback: { x: -140, y: -220 },
          cooldownMs: 400
        },
        {
          id: 'fire-jet',
          type: 'fire',
          x: 220,
          y: 80,
          width: 18,
          height: 72,
          active: false,
          damage: 2
        }
      ]
    });

    expect(step.schema).toBe(HAZARD_2D_25D_SCHEMA);
    expect(step.motion.hazardUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'moving-saw', x: 170, y: 96, direction: 1 })
    ]));
    expect(step.contacts.hitEvents).toEqual([
      expect.objectContaining({ hazardId: 'spike-pit', actorId: 'hero', damage: 1, type: 'spikes' })
    ]);
    expect(step.damage).toMatchObject({
      totalDamage: 1,
      health: { actorId: 'hero', from: 3, to: 2 }
    });
    expect(step.response.knockbacks).toEqual([
      expect.objectContaining({ actorId: 'hero', velocity: { x: -180, y: -260 } })
    ]);
    expect(step.response.invulnerabilityFrames).toEqual([
      expect.objectContaining({ actorId: 'hero', durationMs: 700 })
    ]);
    expect(step.response.respawnCommands).toEqual([
      expect.objectContaining({ actorId: 'hero', checkpointId: 'checkpoint-hill', x: 72, y: 178 })
    ]);
    expect(step.stateUpdates).toMatchObject({
      actor: { id: 'hero', health: 2, invulnerabilityMs: 700, x: 72, y: 178 },
      hazardCooldowns: [expect.objectContaining({ hazardId: 'spike-pit', cooldownMs: 500 })]
    });
    expect(step.effects.applied).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'damage-flash', targetId: 'hero' }),
      expect.objectContaining({ type: 'hazard-sparks', hazardId: 'spike-pit' }),
      expect.objectContaining({ type: 'camera-shake', trauma: expect.any(Number) })
    ]));
    expect(step.events.queue).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'hazard:hit', hazardId: 'spike-pit', actorId: 'hero' }),
      expect.objectContaining({ type: 'actor:damage', actorId: 'hero', damage: 1 }),
      expect.objectContaining({ type: 'actor:respawn', actorId: 'hero', checkpointId: 'checkpoint-hill' })
    ]));
    expect(step.editor.panels).toEqual(expect.arrayContaining([
      'HazardDirector',
      'DamageZones',
      'MovingHazards',
      'Knockback',
      'InvulnerabilityFrames',
      'RespawnRoute',
      'RuntimeDebug'
    ]));
    expect(step.runtimeSync.payloads).toEqual(expect.arrayContaining([
      'hazards',
      'motion',
      'contacts',
      'damage',
      'response',
      'effects',
      'events'
    ]));
    expect(step.debugDraw.map((command) => command.op)).toEqual(expect.arrayContaining([
      'debug:hazard-hitbox',
      'debug:hazard-contact',
      'debug:hazard-knockback',
      'debug:respawn-route'
    ]));
    expect(step.quality.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'hazard-contact', pass: true }),
      expect.objectContaining({ id: 'hazard-damage', pass: true }),
      expect.objectContaining({ id: 'hazard-response', pass: true }),
      expect.objectContaining({ id: 'hazard-motion', pass: true }),
      expect.objectContaining({ id: 'editor-runtime-hazard-sync', pass: true })
    ]));
  });

  it('is wired into the official 2D/2.5D platformer demo', () => {
    const root = join(process.cwd(), 'examples/2d-25d-platformer-demo');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    const readme = readFileSync(join(root, 'README.md'), 'utf8');

    expect(main).toContain('createHazard2D25DDirectorStep');
    expect(main).toContain('HazardDirector');
    expect(main).toContain('DamageZones');
    expect(main).toContain('InvulnerabilityFrames');
    expect(readme).toContain('hazard director');
    expect(readme).toContain('damage zones');
    expect(readme).toContain('knockback and respawn');
  });
});
