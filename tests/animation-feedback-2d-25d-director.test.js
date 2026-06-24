import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ANIMATION_FEEDBACK_2D_25D_SCHEMA,
  createAnimationFeedback2D25DDirectorStep
} from '../src/index.js';

describe('2D/2.5D animation feedback director', () => {
  it('turns animation state and combat events into hitstop, flashes, particles, audio, combo, camera impulses, debug, and editor data', () => {
    const step = createAnimationFeedback2D25DDirectorStep({
      delta: 1 / 60,
      timeMs: 176,
      actor: { id: 'hero', facing: 'right' },
      animation: { state: 'attack', elapsedMs: 176, previousState: 'run' },
      clips: {
        idle: 'hero_idle',
        run: 'hero_run',
        attack: 'hero_attack_01',
        'attack-2': 'hero_attack_02',
        hurt: 'hero_hurt'
      },
      locks: { attack: 240 },
      combat: {
        damageEvents: [
          {
            attackerId: 'hero',
            targetId: 'slime',
            hitboxId: 'sword',
            damage: 3,
            point: { x: 74, y: 52 },
            tags: ['slash', 'critical']
          }
        ],
        healthUpdates: { slime: { previous: 5, current: 2 } }
      },
      combo: {
        actorId: 'hero',
        currentIndex: 1,
        inputBuffered: true,
        windows: [
          { fromState: 'attack', nextState: 'attack-2', openMs: 120, closeMs: 240 }
        ]
      },
      feedback: {
        hitstopMsPerDamage: 6,
        maxHitstopMs: 24,
        hurtFlashMs: 90,
        cameraTraumaPerDamage: 0.08,
        particlePreset: 'slash-sparks',
        audioCue: 'sword-hit',
        freezeAttacker: true,
        freezeTarget: true
      }
    });

    expect(step.schema).toBe(ANIMATION_FEEDBACK_2D_25D_SCHEMA);
    expect(step.animation).toMatchObject({
      activeState: 'attack',
      clip: 'hero_attack_01',
      previousState: 'run',
      locked: true,
      lockRemainingMs: 64
    });
    expect(step.hitstop).toMatchObject({
      active: true,
      durationMs: 18,
      freezeTargets: ['hero', 'slime']
    });
    expect(step.flashes).toEqual([
      expect.objectContaining({ targetId: 'slime', durationMs: 90, kind: 'hurt-flash' })
    ]);
    expect(step.particles.commands).toEqual([
      expect.objectContaining({ preset: 'slash-sparks', x: 74, y: 52, targetId: 'slime' })
    ]);
    expect(step.audio.cues).toEqual([
      expect.objectContaining({ cue: 'sword-hit', targetId: 'slime' })
    ]);
    expect(step.camera.impulses).toEqual([
      expect.objectContaining({ trauma: 0.24, reason: 'combat-hit' })
    ]);
    expect(step.combo).toMatchObject({
      activeWindow: true,
      queuedState: 'attack-2',
      currentIndex: 1,
      nextIndex: 2
    });
    expect(step.editor.panels).toEqual(expect.arrayContaining([
      'AnimationFeedback',
      'Hitstop',
      'HurtFlash',
      'ImpactParticles',
      'AudioCues',
      'ComboWindows',
      'CameraImpulse',
      'RuntimeDebug'
    ]));
    expect(step.runtimeSync.payloads).toEqual(expect.arrayContaining([
      'animation',
      'hitstop',
      'flashes',
      'particles',
      'audio',
      'combo',
      'camera'
    ]));
    expect(step.debugDraw.map((command) => command.op)).toEqual(expect.arrayContaining([
      'debug:animation-state',
      'debug:hitstop',
      'debug:hurt-flash',
      'debug:impact-particle',
      'debug:combo-window'
    ]));
    expect(step.quality.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'animation-clip-resolved', pass: true }),
      expect.objectContaining({ id: 'combat-hitstop', pass: true }),
      expect.objectContaining({ id: 'hurt-flash-feedback', pass: true }),
      expect.objectContaining({ id: 'combo-window', pass: true }),
      expect.objectContaining({ id: 'editor-runtime-feedback-sync', pass: true })
    ]));
  });

  it('is wired into the official 2D/2.5D platformer demo', () => {
    const root = join(process.cwd(), 'examples/2d-25d-platformer-demo');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    const readme = readFileSync(join(root, 'README.md'), 'utf8');

    expect(main).toContain('createAnimationFeedback2D25DDirectorStep');
    expect(main).toContain('Hitstop');
    expect(main).toContain('ComboWindows');
    expect(main).toContain('ImpactParticles');
    expect(readme).toContain('hitstop');
    expect(readme).toContain('combo windows');
    expect(readme).toContain('impact particles');
  });
});
