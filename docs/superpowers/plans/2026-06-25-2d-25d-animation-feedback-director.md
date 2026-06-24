# 2D/2.5D Animation Feedback Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 2D/2.5D animation and combat feedback director that turns controller animation state and combat events into hitstop, flashes, particles, audio cues, combo windows, camera impulses, editor panels, runtime sync, and debug draw.

**Architecture:** Implement a pure data planner in `src/gameplay/AnimationFeedback2D25DDirector.js`. It should sit after `createPlatformer2DControllerStep()` and `createLevel2D25DGameplayLoop()` and feed the existing camera director, renderer, audio, particles, and editor/debug surfaces.

**Tech Stack:** JavaScript ES modules, Vitest, official `examples/2d-25d-platformer-demo`, existing public API contract snapshots.

---

### Task 1: Failing Feedback Director Contract Test

**Files:**
- Create: `tests/animation-feedback-2d-25d-director.test.js`
- Modify later: `src/gameplay/AnimationFeedback2D25DDirector.js`
- Modify later: `src/index.js`
- Modify later: `examples/2d-25d-platformer-demo/src/main.js`
- Modify later: `examples/2d-25d-platformer-demo/README.md`

- [x] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/animation-feedback-2d-25d-director.test.js`
Expected: FAIL because the public API and demo integration do not exist yet.

### Task 2: Animation Feedback Runtime

**Files:**
- Create: `src/gameplay/AnimationFeedback2D25DDirector.js`
- Modify: `src/index.js`
- Test: `tests/animation-feedback-2d-25d-director.test.js`

- [ ] **Step 1: Implement the pure feedback step**

The director must normalize animation state, resolve clips, calculate animation locks, create hitstop freeze targets, emit hurt flashes, spawn impact particle commands, emit audio cues, produce camera trauma impulses, evaluate combo windows, expose editor/runtime sync, debug commands, and quality checks.

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/animation-feedback-2d-25d-director.test.js`
Expected: PASS.

### Task 3: Official Demo Integration

**Files:**
- Modify: `examples/2d-25d-platformer-demo/src/main.js`
- Modify: `examples/2d-25d-platformer-demo/README.md`
- Test: `tests/animation-feedback-2d-25d-director.test.js`

- [ ] **Step 1: Feed demo combat and animation through the director**

The demo should build `debugOverlay.feedback` from controller animation and level combat events, use flash feedback when drawing the enemy, and display hitstop/combo/impact panel labels in the debug overlay.

- [ ] **Step 2: Run focused regression**

Run: `npm test -- tests/animation-feedback-2d-25d-director.test.js tests/platformer-2d-controller.test.js tests/level-2d-25d-gameplay-loop.test.js`
Expected: PASS.

### Task 4: Verification, Docs, Contract, Commit

**Files:**
- Modify generated docs if required: `docs/api/index.html`
- Modify generated docs if required: `docs/api/manifest.json`
- Modify contract if required: `tests/contract/golden/omnicore-core-api.json`

- [ ] **Step 1: Run regression commands**

Run:
`npm test -- tests/animation-feedback-2d-25d-director.test.js tests/camera-2d-25d-director.test.js tests/platformer-2d-controller.test.js tests/level-2d-25d-gameplay-loop.test.js tests/tilemap-2d-25d-authoring-loop.test.js tests/arcade-2d-gameplay-hardening.test.js tests/scene-2d-25d-runtime-editor-closure.test.js`
`npm run lint`
`npm run build`
`npm run docs:generate`
`npm test -- tests/contract/api-contract-snapshot.test.js`
`git diff --check`

- [ ] **Step 2: Commit and push**

Run:
`git add src/gameplay/AnimationFeedback2D25DDirector.js src/index.js tests/animation-feedback-2d-25d-director.test.js examples/2d-25d-platformer-demo/src/main.js examples/2d-25d-platformer-demo/README.md docs/superpowers/plans/2026-06-25-2d-25d-animation-feedback-director.md docs/api/index.html docs/api/manifest.json tests/contract/golden/omnicore-core-api.json`
`git commit -m "feat(2d): add animation feedback director"`
`git push origin codex/contract-benchmark-ci`
