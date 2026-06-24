# 2D/2.5D Encounter Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 2D/2.5D encounter director that coordinates enemy perception, patrol/chase/attack decisions, spawn waves, threat budget, loot/events, editor controls, runtime sync, and debug draw.

**Architecture:** Implement a pure data planner in `src/gameplay/Encounter2D25DDirector.js`. It should sit beside the platformer controller, level gameplay loop, camera director, and animation feedback director so a playable template can use one coherent enemy/encounter layer.

**Tech Stack:** JavaScript ES modules, Vitest, official `examples/2d-25d-platformer-demo`, public API contract snapshots.

---

### Task 1: Failing Encounter Director Contract Test

**Files:**
- Create: `tests/encounter-2d-25d-director.test.js`
- Modify later: `src/gameplay/Encounter2D25DDirector.js`
- Modify later: `src/index.js`
- Modify later: `examples/2d-25d-platformer-demo/src/main.js`
- Modify later: `examples/2d-25d-platformer-demo/README.md`

- [x] **Step 1: Write the failing test**

```js
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ENCOUNTER_2D_25D_SCHEMA,
  createEncounter2D25DDirectorStep
} from '../src/index.js';

describe('2D/2.5D encounter director', () => {
  it('coordinates perception, AI decisions, spawn waves, threat budget, rewards, debug, editor, and runtime sync', () => {
    const step = createEncounter2D25DDirectorStep({
      delta: 0.25,
      player: { id: 'hero', x: 100, y: 64, width: 16, height: 24, health: 6 },
      enemies: [
        {
          id: 'slime-a',
          type: 'slime',
          x: 134,
          y: 68,
          width: 18,
          height: 18,
          health: 3,
          threat: 2,
          perception: { radius: 96, attackRange: 48 },
          patrol: { from: 96, to: 180, speed: 24, direction: 1 },
          attack: { damage: 1, cooldownMs: 0 },
          loot: [{ id: 'coin', chance: 1, amount: 3 }]
        },
        {
          id: 'bat-b',
          type: 'bat',
          x: 300,
          y: 60,
          width: 18,
          height: 14,
          health: 2,
          threat: 3,
          perception: { radius: 80, attackRange: 28 },
          patrol: { from: 280, to: 340, speed: 36, direction: -1 }
        }
      ],
      spawners: [
        {
          id: 'wave-1',
          prefab: 'slime',
          count: 2,
          cooldownMs: 0,
          trigger: { x: 80, y: 40, width: 160, height: 96 },
          spawnPoints: [{ x: 180, y: 80 }, { x: 210, y: 80 }]
        }
      ],
      director: {
        threatLimit: 5,
        difficulty: 1.25,
        leashDistance: 128
      }
    });

    expect(step.schema).toBe(ENCOUNTER_2D_25D_SCHEMA);
    expect(step.perception.detected).toEqual([
      expect.objectContaining({
        enemyId: 'slime-a',
        targetId: 'hero',
        inAttackRange: true
      })
    ]);
    expect(step.ai.decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        enemyId: 'slime-a',
        state: 'attack',
        targetId: 'hero',
        nextAnimation: 'attack',
        intent: 'melee'
      }),
      expect.objectContaining({
        enemyId: 'bat-b',
        state: 'patrol',
        nextAnimation: 'fly'
      })
    ]));
    expect(step.ai.pathRequests).toEqual([
      expect.objectContaining({ enemyId: 'slime-a', from: expect.any(Object), to: expect.any(Object) })
    ]);
    expect(step.combat.attackEvents).toEqual([
      expect.objectContaining({ attackerId: 'slime-a', targetId: 'hero', damage: 1 })
    ]);
    expect(step.spawning.spawnCommands).toEqual([
      expect.objectContaining({ spawnerId: 'wave-1', prefab: 'slime', x: 180, y: 80 }),
      expect.objectContaining({ spawnerId: 'wave-1', prefab: 'slime', x: 210, y: 80 })
    ]);
    expect(step.threat).toMatchObject({
      activeThreat: 5,
      limit: 5,
      overBudget: false,
      difficulty: 1.25
    });
    expect(step.rewards.dropTable).toEqual([
      expect.objectContaining({ enemyId: 'slime-a', itemId: 'coin', amount: 3 })
    ]);
    expect(step.events.queue).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'encounter:enemy-attack', enemyId: 'slime-a' }),
      expect.objectContaining({ type: 'encounter:spawn-wave', spawnerId: 'wave-1' })
    ]));
    expect(step.editor.panels).toEqual(expect.arrayContaining([
      'EncounterDirector',
      'EnemyPerception',
      'ThreatBudget',
      'SpawnWaves',
      'LootDrops',
      'AIDebug',
      'RuntimeDebug'
    ]));
    expect(step.runtimeSync.payloads).toEqual(expect.arrayContaining([
      'perception',
      'ai',
      'spawning',
      'threat',
      'rewards',
      'events'
    ]));
    expect(step.debugDraw.map((command) => command.op)).toEqual(expect.arrayContaining([
      'debug:enemy-perception',
      'debug:enemy-attack-range',
      'debug:enemy-intent',
      'debug:spawn-wave',
      'debug:threat-budget'
    ]));
    expect(step.quality.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'enemy-perception', pass: true }),
      expect.objectContaining({ id: 'enemy-ai-decision', pass: true }),
      expect.objectContaining({ id: 'spawn-wave', pass: true }),
      expect.objectContaining({ id: 'threat-budget', pass: true }),
      expect.objectContaining({ id: 'editor-runtime-encounter-sync', pass: true })
    ]));
  });

  it('is wired into the official 2D/2.5D platformer demo', () => {
    const root = join(process.cwd(), 'examples/2d-25d-platformer-demo');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    const readme = readFileSync(join(root, 'README.md'), 'utf8');

    expect(main).toContain('createEncounter2D25DDirectorStep');
    expect(main).toContain('EncounterDirector');
    expect(main).toContain('ThreatBudget');
    expect(main).toContain('SpawnWaves');
    expect(readme).toContain('encounter director');
    expect(readme).toContain('threat budget');
    expect(readme).toContain('spawn waves');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/encounter-2d-25d-director.test.js`
Expected: FAIL because the public API and demo integration do not exist yet.

### Task 2: Encounter Runtime

**Files:**
- Create: `src/gameplay/Encounter2D25DDirector.js`
- Modify: `src/index.js`
- Test: `tests/encounter-2d-25d-director.test.js`

- [ ] **Step 1: Implement the pure encounter step**

The director must normalize player/enemy/spawner data, calculate perception, choose AI states, emit path requests, attack events, spawn commands, threat budget summary, rewards, events, editor panels, runtime sync payloads, debug draw, and quality checks.

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/encounter-2d-25d-director.test.js`
Expected: PASS.

### Task 3: Official Demo Integration

**Files:**
- Modify: `examples/2d-25d-platformer-demo/src/main.js`
- Modify: `examples/2d-25d-platformer-demo/README.md`
- Test: `tests/encounter-2d-25d-director.test.js`

- [ ] **Step 1: Feed the demo enemy through the director**

The demo should build `debugOverlay.encounter` from hero/enemy state, use the director to describe enemy intent, and display encounter panel labels in the debug overlay.

- [ ] **Step 2: Run focused regression**

Run: `npm test -- tests/encounter-2d-25d-director.test.js tests/animation-feedback-2d-25d-director.test.js tests/level-2d-25d-gameplay-loop.test.js`
Expected: PASS.

### Task 4: Verification, Docs, Contract, Commit

**Files:**
- Modify generated docs if required: `docs/api/index.html`
- Modify generated docs if required: `docs/api/manifest.json`
- Modify contract if required: `tests/contract/golden/omnicore-core-api.json`

- [ ] **Step 1: Run regression commands**

Run:
`npm test -- tests/encounter-2d-25d-director.test.js tests/animation-feedback-2d-25d-director.test.js tests/camera-2d-25d-director.test.js tests/platformer-2d-controller.test.js tests/level-2d-25d-gameplay-loop.test.js tests/tilemap-2d-25d-authoring-loop.test.js tests/arcade-2d-gameplay-hardening.test.js tests/scene-2d-25d-runtime-editor-closure.test.js`
`npm run lint`
`npm run build`
`npm run docs:generate`
`npm test -- tests/contract/api-contract-snapshot.test.js`
`git diff --check`

- [ ] **Step 2: Commit and push**

Run:
`git add src/gameplay/Encounter2D25DDirector.js src/index.js tests/encounter-2d-25d-director.test.js examples/2d-25d-platformer-demo/src/main.js examples/2d-25d-platformer-demo/README.md docs/superpowers/plans/2026-06-25-2d-25d-encounter-director.md docs/api/index.html docs/api/manifest.json tests/contract/golden/omnicore-core-api.json`
`git commit -m "feat(2d): add encounter director"`
`git push origin codex/contract-benchmark-ci`
