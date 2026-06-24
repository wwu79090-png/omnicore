import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COMBAT_2D_25D_SCHEMA,
  createCombat2D25DDirectorStep
} from '../src/index.js';

describe('2D/2.5D combat director', () => {
  it('coordinates hitboxes, hurtboxes, team filters, guard/parry, damage, knockback, stagger, hitstop, combo, feedback, debug, editor, and runtime sync', () => {
    const step = createCombat2D25DDirectorStep({
      delta: 0.016,
      attackers: [
        {
          id: 'hero',
          team: 'player',
          x: 96,
          y: 96,
          width: 20,
          height: 28,
          facing: 'right',
          attacks: [
            {
              id: 'slash-1',
              active: true,
              frame: 3,
              hitstopMs: 60,
              combo: { nextState: 'slash-2', inputWindowMs: 180 },
              hitboxes: [
                {
                  id: 'blade',
                  x: 18,
                  y: 6,
                  width: 30,
                  height: 12,
                  damage: 2,
                  knockback: { x: 160, y: -80 },
                  staggerMs: 220,
                  tags: ['slash']
                }
              ]
            }
          ]
        }
      ],
      defenders: [
        {
          id: 'slime',
          team: 'enemy',
          x: 128,
          y: 100,
          width: 20,
          height: 20,
          health: 5,
          hurtboxes: [{ id: 'body', x: 0, y: 0, width: 20, height: 20 }]
        },
        {
          id: 'shield-goblin',
          team: 'enemy',
          x: 140,
          y: 98,
          width: 20,
          height: 24,
          health: 4,
          guard: { active: true, parryWindowMs: 100, elapsedMs: 60, damageReduction: 1 },
          hurtboxes: [{ id: 'guard', x: 0, y: 0, width: 20, height: 24 }]
        },
        {
          id: 'ally',
          team: 'player',
          x: 126,
          y: 100,
          width: 18,
          height: 20,
          health: 4,
          hurtboxes: [{ id: 'body', x: 0, y: 0, width: 18, height: 20 }]
        }
      ],
      combo: {
        actorId: 'hero',
        currentState: 'slash-1',
        bufferedInput: true,
        chainIndex: 1
      }
    });

    expect(step.schema).toBe(COMBAT_2D_25D_SCHEMA);
    expect(step.hitDetection.contacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ attackerId: 'hero', defenderId: 'slime', hitboxId: 'blade', hurtboxId: 'body', result: 'hit' }),
      expect.objectContaining({ attackerId: 'hero', defenderId: 'shield-goblin', hitboxId: 'blade', hurtboxId: 'guard', result: 'parry' })
    ]));
    expect(step.hitDetection.filtered).toEqual([
      expect.objectContaining({ attackerId: 'hero', defenderId: 'ally', reason: 'same-team' })
    ]);
    expect(step.guards.parries).toEqual([
      expect.objectContaining({ defenderId: 'shield-goblin', attackerId: 'hero', parryWindowMs: 100 })
    ]);
    expect(step.damage.events).toEqual([
      expect.objectContaining({ attackerId: 'hero', defenderId: 'slime', damage: 2, healthFrom: 5, healthTo: 3 })
    ]);
    expect(step.damage.healthUpdates).toEqual([
      expect.objectContaining({ defenderId: 'slime', health: 3 })
    ]);
    expect(step.response.knockbacks).toEqual([
      expect.objectContaining({ targetId: 'slime', velocity: { x: 160, y: -80 } })
    ]);
    expect(step.response.staggers).toEqual([
      expect.objectContaining({ targetId: 'slime', durationMs: 220 })
    ]);
    expect(step.response.hitstop).toMatchObject({ active: true, durationMs: 60, actors: ['hero', 'slime'] });
    expect(step.combo).toMatchObject({
      actorId: 'hero',
      currentState: 'slash-1',
      nextState: 'slash-2',
      chainIndex: 2,
      windowOpen: true,
      bufferedInput: true
    });
    expect(step.effects.applied).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'hit-spark', targetId: 'slime' }),
      expect.objectContaining({ type: 'parry-spark', targetId: 'shield-goblin' }),
      expect.objectContaining({ type: 'attack-audio', cue: 'slash-hit' })
    ]));
    expect(step.events.queue).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'combat:hit', attackerId: 'hero', defenderId: 'slime' }),
      expect.objectContaining({ type: 'combat:parry', attackerId: 'hero', defenderId: 'shield-goblin' }),
      expect.objectContaining({ type: 'combat:combo-buffer', actorId: 'hero', nextState: 'slash-2' })
    ]));
    expect(step.editor.panels).toEqual(expect.arrayContaining([
      'CombatDirector',
      'Hitboxes',
      'Hurtboxes',
      'TeamFilters',
      'ParryWindows',
      'Knockback',
      'ComboChains',
      'RuntimeDebug'
    ]));
    expect(step.runtimeSync.payloads).toEqual(expect.arrayContaining([
      'hitDetection',
      'guards',
      'damage',
      'response',
      'combo',
      'effects',
      'events'
    ]));
    expect(step.debugDraw.map((command) => command.op)).toEqual(expect.arrayContaining([
      'debug:combat-hitbox',
      'debug:combat-hurtbox',
      'debug:combat-contact',
      'debug:combat-knockback',
      'debug:combat-parry'
    ]));
    expect(step.quality.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'combat-hit-detection', pass: true }),
      expect.objectContaining({ id: 'combat-team-filter', pass: true }),
      expect.objectContaining({ id: 'combat-guard-resolution', pass: true }),
      expect.objectContaining({ id: 'combat-damage-response', pass: true }),
      expect.objectContaining({ id: 'editor-runtime-combat-sync', pass: true })
    ]));
  });

  it('is wired into the official 2D/2.5D platformer demo', () => {
    const root = join(process.cwd(), 'examples/2d-25d-platformer-demo');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    const readme = readFileSync(join(root, 'README.md'), 'utf8');

    expect(main).toContain('createCombat2D25DDirectorStep');
    expect(main).toContain('CombatDirector');
    expect(main).toContain('Hitboxes');
    expect(main).toContain('ParryWindows');
    expect(readme).toContain('combat director');
    expect(readme).toContain('hitbox/hurtbox resolver');
    expect(readme).toContain('parry windows');
  });
});
