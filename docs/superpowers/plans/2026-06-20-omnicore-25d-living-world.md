# OmniCore 2.5D Living World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build OmniCore's 2.5D Living World vertical slice one subsystem at a time: NPC social awareness, world memory, emotional palette descriptors, mixed reality sensor fallback, and editor co-creation planning.

**Architecture:** Add focused descriptor-first modules under `src/livingworld/` and export them through `src/index.js`. Keep `Dimension3D` responsible for projection/render metadata, while the new modules produce deterministic decisions, memory patches, renderer descriptors, sensor samples, and editor authoring plans. Editor integration stays thin inside `packages/omnicore-editor/src/editor-app.js`.

**Tech Stack:** JavaScript ESM, Vitest, existing OmniCore descriptor patterns, existing editor DOM app, no new runtime dependencies.

---

## File Structure

- Create `src/livingworld/SocialAwareness25D.js`
  - Deterministic NPC interaction decision engine.
- Create `src/livingworld/WorldMemory25D.js`
  - Bounded event memory, scene patch resolution, dialogue branch resolution, snapshot/restore.
- Create `src/livingworld/EmotionalPalette25D.js`
  - Renderer-agnostic mood descriptor resolver.
- Create `src/livingworld/RealitySensor25D.js`
  - Safe optional browser sensor adapter with local-time fallback.
- Create `src/livingworld/EditorCoCreator25D.js`
  - Deterministic natural-language 2.5D authoring planner.
- Create `src/livingworld/index.js`
  - Re-export the five modules.
- Modify `src/index.js`
  - Import and export the new modules on named exports and `OmniCore`.
- Modify `packages/omnicore-editor/src/editor-app.js`
  - Add `plan25DCoCreation`, `previewLivingWorld25D`, and `previewWorldMemory25D` wrappers.
- Create `tests/living-world-25d.test.js`
  - Phase A tests.
- Create `tests/emotional-mixed-reality-25d.test.js`
  - Phase B tests.
- Create `tests/editor-cocreation-25d.test.js`
  - Phase C tests and editor wrapper test.
- Create `tests/omnicore-25d-living-world-suite.test.js`
  - Integration tests across memory, emotion, and co-creation descriptors.
- Create `docs/25d-living-world.md`
  - User-facing docs and examples.

---

### Task 1: Phase A1 SocialAwareness25D

**Files:**
- Create: `tests/living-world-25d.test.js`
- Create: `src/livingworld/SocialAwareness25D.js`
- Create: `src/livingworld/index.js`
- Modify: `src/index.js`

- [ ] **Step 1: Write the failing social awareness tests**

Create `tests/living-world-25d.test.js` with these tests:

```js
import { describe, expect, it } from 'vitest';
import {
  SocialAwareness25D
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
});
```

- [ ] **Step 2: Run RED test**

Run:

```bash
npx vitest run tests/living-world-25d.test.js
```

Expected: FAIL because `SocialAwareness25D` is not exported.

- [ ] **Step 3: Implement `SocialAwareness25D`**

Create `src/livingworld/SocialAwareness25D.js`:

```js
export class SocialAwareness25D {
  constructor({ greetingRadius = 48, debug = false } = {}) {
    this.greetingRadius = Math.max(0, Number(greetingRadius) || 0);
    this.debug = Boolean(debug);
  }

  evaluate({ npcs = [], locations = [], weather = null } = {}) {
    const validNpcs = normalizeNpcs(npcs);
    return [
      ...this._greetings(validNpcs),
      ...this._queues(validNpcs, locations),
      ...this._shelters(validNpcs, locations, weather)
    ];
  }

  _greetings(npcs) {
    const decisions = [];
    for (let leftIndex = 0; leftIndex < npcs.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < npcs.length; rightIndex += 1) {
        const left = npcs[leftIndex];
        const right = npcs[rightIndex];
        if (!compatible(left, right)) continue;
        if (distance2D(left, right) > this.greetingRadius) continue;
        decisions.push({
          type: 'greet',
          actorId: left.id,
          targetId: right.id,
          animation: left.animationSet?.greet || 'nod',
          reason: 'proximity:friendly'
        });
      }
    }
    return decisions;
  }

  _queues(npcs, locations) {
    const shops = locations.filter((location) => location?.type === 'shop');
    if (!shops.length) return [];
    const shop = shops[0];
    const queued = npcs
      .filter((npc) => npc.wants.includes('shop'))
      .sort((left, right) => left.id.localeCompare(right.id));
    const direction = shop.queueDirection || { x: 0, y: 16 };
    return queued.map((npc, slot) => ({
      type: 'queue',
      actorId: npc.id,
      locationId: shop.id,
      slot,
      position: {
        x: Number(shop.x || 0) + Number(direction.x || 0) * slot,
        y: Number(shop.y || 0) + Number(direction.y || 0) * slot,
        z: Number(shop.z || 0)
      },
      reason: 'location:queue'
    }));
  }

  _shelters(npcs, locations, weather) {
    if (weather?.type !== 'rain' || Number(weather.intensity || 0) <= 0) return [];
    const shelters = locations.filter((location) => location?.type === 'shelter');
    return npcs
      .filter((npc) => npc.needsShelter)
      .map((npc) => {
        const shelter = closest(npc, shelters);
        if (!shelter) return null;
        return {
          type: 'shelter',
          actorId: npc.id,
          locationId: shelter.id,
          groupId: `rain-shelter:${shelter.id}`,
          position: { x: Number(shelter.x || 0), y: Number(shelter.y || 0), z: Number(shelter.z || 0) },
          reason: 'weather:rain'
        };
      })
      .filter(Boolean);
  }
}

function normalizeNpcs(npcs) {
  return (Array.isArray(npcs) ? npcs : [])
    .filter((npc) => npc && npc.id)
    .map((npc) => ({
      ...npc,
      x: Number(npc.x || npc.position?.x || 0),
      y: Number(npc.y || npc.position?.y || 0),
      z: Number(npc.z || npc.position?.z || 0),
      tags: Array.isArray(npc.tags) ? npc.tags : [],
      wants: Array.isArray(npc.wants) ? npc.wants : []
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function compatible(left, right) {
  return left.tags.includes('friendly') && right.tags.includes('friendly');
}

function closest(point, candidates) {
  return candidates.reduce((best, candidate) => {
    if (!best) return candidate;
    return distance2D(point, candidate) < distance2D(point, best) ? candidate : best;
  }, null);
}

function distance2D(left, right) {
  return Math.hypot(Number(left.x || 0) - Number(right.x || 0), Number(left.y || 0) - Number(right.y || 0));
}

export default SocialAwareness25D;
```

Create `src/livingworld/index.js`:

```js
export { SocialAwareness25D } from './SocialAwareness25D.js';
```

Modify `src/index.js`:

```js
import { SocialAwareness25D } from './livingworld/index.js';
```

Add `SocialAwareness25D` to the `OmniCore` object and the named export list.

- [ ] **Step 4: Run GREEN test**

Run:

```bash
npx vitest run tests/living-world-25d.test.js
```

Expected: PASS for social tests.

---

### Task 2: Phase A2 WorldMemory25D

**Files:**
- Modify: `tests/living-world-25d.test.js`
- Create: `src/livingworld/WorldMemory25D.js`
- Modify: `src/livingworld/index.js`
- Modify: `src/index.js`

- [ ] **Step 1: Add failing memory tests**

Append to `tests/living-world-25d.test.js`:

```js
import {
  SocialAwareness25D,
  WorldMemory25D
} from '../src/index.js';
```

Add tests:

```js
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
```

- [ ] **Step 2: Run RED test**

Run:

```bash
npx vitest run tests/living-world-25d.test.js
```

Expected: FAIL because `WorldMemory25D` is not exported.

- [ ] **Step 3: Implement `WorldMemory25D`**

Create `src/livingworld/WorldMemory25D.js` with `record`, `snapshot`, `restore`, `resolveScenePatches`, and `resolveDialogue`. Keep events bounded by `maxEvents`, reject missing `type`, and return descriptors only.

- [ ] **Step 4: Export and verify**

Update `src/livingworld/index.js`:

```js
export { SocialAwareness25D } from './SocialAwareness25D.js';
export { WorldMemory25D } from './WorldMemory25D.js';
```

Update `src/index.js` imports, `OmniCore`, and named exports.

Run:

```bash
npx vitest run tests/living-world-25d.test.js
```

Expected: PASS.

---

### Task 3: Phase B1 EmotionalPalette25D

**Files:**
- Create: `tests/emotional-mixed-reality-25d.test.js`
- Create: `src/livingworld/EmotionalPalette25D.js`
- Modify: `src/livingworld/index.js`
- Modify: `src/index.js`

- [ ] **Step 1: Write failing emotional palette tests**

Create `tests/emotional-mixed-reality-25d.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { EmotionalPalette25D } from '../src/index.js';

describe('OmniCore 2.5D emotional and mixed reality layer', () => {
  it('resolves combat, safe, sad, and neutral mood descriptors', () => {
    const palette = new EmotionalPalette25D();

    expect(palette.resolve({ mood: 'combat', intensity: 0.8 })).toMatchObject({
      pipeline: 'omnicore-25d-emotional-palette/v1',
      mood: 'combat',
      colorTemperature: expect.any(Number),
      vignette: expect.objectContaining({ strength: expect.any(Number) }),
      tint: expect.objectContaining({ color: '#ff3b30' })
    });
    expect(palette.resolve({ mood: 'safe', intensity: 0.5 }).tint.color).toBe('#f59e0b');
    expect(palette.resolve({ mood: 'sad', intensity: 1 }).saturation).toBeLessThan(1);
    expect(palette.resolve({ mood: 'neutral', intensity: 9 })).toMatchObject({
      mood: 'neutral',
      intensity: 1,
      tint: { color: '#ffffff', amount: 0 }
    });
  });
});
```

- [ ] **Step 2: Run RED test**

Run:

```bash
npx vitest run tests/emotional-mixed-reality-25d.test.js
```

Expected: FAIL because `EmotionalPalette25D` is not exported.

- [ ] **Step 3: Implement `EmotionalPalette25D`**

Create `src/livingworld/EmotionalPalette25D.js`. Implement `resolve({ mood, intensity, transitionMs })`, clamp intensity to `0..1`, and return renderer-agnostic descriptors for `combat`, `safe`, `sad`, and `neutral`.

- [ ] **Step 4: Export and verify**

Update `src/livingworld/index.js` and `src/index.js`.

Run:

```bash
npx vitest run tests/emotional-mixed-reality-25d.test.js
```

Expected: PASS.

---

### Task 4: Phase B2 RealitySensor25D

**Files:**
- Modify: `tests/emotional-mixed-reality-25d.test.js`
- Create: `src/livingworld/RealitySensor25D.js`
- Modify: `src/livingworld/index.js`
- Modify: `src/index.js`

- [ ] **Step 1: Add failing sensor tests**

Extend imports:

```js
import { EmotionalPalette25D, RealitySensor25D } from '../src/index.js';
```

Add tests:

```js
it('uses local time daylight fallback without requesting geolocation', async () => {
  const sensors = new RealitySensor25D({
    now: () => new Date('2026-06-20T22:00:00')
  });

  const sample = await sensors.sample({ daylight: true, geolocation: false });

  expect(sample.daylight).toMatchObject({ source: 'local-time', phase: 'night' });
  expect(sample.permissions.geolocation).toBe('not-requested');
});

it('returns permission status data when geolocation is denied', async () => {
  const sensors = new RealitySensor25D({
    navigator: {
      geolocation: {
        getCurrentPosition: (_success, failure) => failure({ code: 1, message: 'denied' })
      }
    }
  });

  const sample = await sensors.sample({ daylight: true, geolocation: true });

  expect(sample.permissions.geolocation).toBe('denied');
  expect(sample.daylight.source).toBe('local-time');
});

it('returns unavailable zero tilt when device orientation is missing', async () => {
  const sensors = new RealitySensor25D({ window: {} });
  const sample = await sensors.sample({ orientation: true });

  expect(sample.orientation).toEqual({ source: 'unavailable', tiltX: 0, tiltY: 0 });
});
```

- [ ] **Step 2: Run RED test**

Run:

```bash
npx vitest run tests/emotional-mixed-reality-25d.test.js
```

Expected: FAIL because `RealitySensor25D` is not exported.

- [ ] **Step 3: Implement `RealitySensor25D`**

Create `src/livingworld/RealitySensor25D.js`. Implement `sample(options)`, local-time daylight fallback, optional geolocation request, denied status, and unavailable orientation fallback.

- [ ] **Step 4: Export and verify**

Update `src/livingworld/index.js` and `src/index.js`.

Run:

```bash
npx vitest run tests/emotional-mixed-reality-25d.test.js
```

Expected: PASS.

---

### Task 5: Phase C1 EditorCoCreator25D

**Files:**
- Create: `tests/editor-cocreation-25d.test.js`
- Create: `src/livingworld/EditorCoCreator25D.js`
- Modify: `src/livingworld/index.js`
- Modify: `src/index.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`

- [ ] **Step 1: Write failing co-creation tests**

Create `tests/editor-cocreation-25d.test.js`:

```js
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { EditorCoCreator25D } from '../src/index.js';

let createEditorApp;

beforeAll(async () => {
  ({ createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href));
});

describe('OmniCore 2.5D editor co-creation', () => {
  it('plans a tower behind a forest with a sword on top from Chinese natural language', () => {
    const coCreator = new EditorCoCreator25D();
    const plan = coCreator.plan({
      prompt: '在这片树林后建一个高塔，塔顶有一把剑',
      scene: {
        entities: [{ id: 'forest', type: 'forest', x: 80, y: 120, bounds: { width: 120, height: 80 } }]
      }
    });

    expect(plan).toMatchObject({
      protocol: 'omnicore-editor-25d-cocreation/v1',
      intent: {
        structure: 'tower',
        placement: { relation: 'behind', anchor: 'forest' },
        prop: { type: 'sword', relation: 'on-top' }
      }
    });
    expect(plan.assets.map((asset) => asset.kind)).toEqual(['model-task', 'model-task']);
    expect(plan.occlusion[0]).toMatchObject({ entityId: 'forest-tower', baselineY: expect.any(Number) });
    expect(plan.shadows[0]).toMatchObject({ entityId: 'forest-tower', type: 'ellipse' });
    expect(plan.eventGraph).toMatchObject({
      format: 'OmniCore.VisualEventGraph',
      nodes: [expect.objectContaining({ id: 'inspect-sword' })]
    });
  });

  it('warns instead of crashing when an anchor cannot be resolved', () => {
    const plan = new EditorCoCreator25D().plan({
      prompt: '在月亮后建塔',
      scene: { entities: [] }
    });

    expect(plan.confidence).toBeLessThan(0.5);
    expect(plan.warnings).toContain('anchor-not-found:moon');
  });

  it('exposes editor app wrapper for 2.5D co-creation plans', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          entities: [{ id: 'forest', type: 'forest', x: 80, y: 120 }]
        }
      }
    });

    const plan = app.plan25DCoCreation({ prompt: '在树林后建一个高塔，塔顶有一把剑' });

    expect(plan.protocol).toBe('omnicore-editor-25d-cocreation/v1');
    expect(app.getState().coCreation25D).toBe(plan);
    app.destroy();
  });
});
```

- [ ] **Step 2: Run RED test**

Run:

```bash
npx vitest run tests/editor-cocreation-25d.test.js
```

Expected: FAIL because `EditorCoCreator25D` and editor wrapper are missing.

- [ ] **Step 3: Implement `EditorCoCreator25D`**

Create deterministic parser in `src/livingworld/EditorCoCreator25D.js`. Recognize `树林`/`forest`, `后`/`behind`, `高塔`/`tower`, `塔顶`/`on-top`, `剑`/`sword`, and `月亮`/`moon` for warning tests. Output the plan protocol from the spec.

- [ ] **Step 4: Add editor wrapper**

Modify `packages/omnicore-editor/src/editor-app.js`:

- Import `EditorCoCreator25D`, `SocialAwareness25D`, and `WorldMemory25D` from `../../../src/livingworld/index.js`.
- Add `plan25DCoCreation`, `previewLivingWorld25D`, and `previewWorldMemory25D` to `api`.
- Implement wrappers that update `current` with `coCreation25D`, `livingWorldPreview25D`, or `worldMemoryPreview25D`.

- [ ] **Step 5: Export and verify**

Update `src/livingworld/index.js` and `src/index.js`.

Run:

```bash
npx vitest run tests/editor-cocreation-25d.test.js
```

Expected: PASS.

---

### Task 6: Integration Suite And Documentation

**Files:**
- Create: `tests/omnicore-25d-living-world-suite.test.js`
- Create: `docs/25d-living-world.md`

- [ ] **Step 1: Write failing integration/docs tests**

Create `tests/omnicore-25d-living-world-suite.test.js`:

```js
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
```

- [ ] **Step 2: Run RED test**

Run:

```bash
npx vitest run tests/omnicore-25d-living-world-suite.test.js
```

Expected: FAIL because docs do not exist and integration path is incomplete.

- [ ] **Step 3: Add docs**

Create `docs/25d-living-world.md` with concrete examples for all five classes and a note that geolocation/device orientation are opt-in.

- [ ] **Step 4: Verify all living world tests**

Run:

```bash
npx vitest run tests/living-world-25d.test.js tests/emotional-mixed-reality-25d.test.js tests/editor-cocreation-25d.test.js tests/omnicore-25d-living-world-suite.test.js
```

Expected: PASS.

---

### Task 7: Final Verification

**Files:**
- All files touched in Tasks 1-6.

- [ ] **Step 1: Run focused adjacent tests**

Run:

```bash
npx vitest run tests/living-world-25d.test.js tests/emotional-mixed-reality-25d.test.js tests/editor-cocreation-25d.test.js tests/omnicore-25d-living-world-suite.test.js tests/industrial-25d-pipeline.test.js tests/dimension3d-25d-hardening.test.js
```

Expected: PASS.

- [ ] **Step 2: Run lint on touched files**

Run:

```bash
npx eslint -c .eslintrc.json --no-eslintrc src/livingworld/*.js src/index.js packages/omnicore-editor/src/editor-app.js tests/living-world-25d.test.js tests/emotional-mixed-reality-25d.test.js tests/editor-cocreation-25d.test.js tests/omnicore-25d-living-world-suite.test.js
```

Expected: no errors or warnings.

- [ ] **Step 3: Report changed files and verification results**

Run:

```bash
git status --short -- src/livingworld src/index.js packages/omnicore-editor/src/editor-app.js tests/living-world-25d.test.js tests/emotional-mixed-reality-25d.test.js tests/editor-cocreation-25d.test.js tests/omnicore-25d-living-world-suite.test.js docs/25d-living-world.md docs/superpowers/specs/2026-06-20-omnicore-25d-living-world-design.md docs/superpowers/plans/2026-06-20-omnicore-25d-living-world.md
```

Expected: only living-world implementation, tests, docs, and the plan/spec files are listed for this work.

---

## Self-Review

- Spec coverage: Task 1 covers NPC social awareness; Task 2 covers world memory and dynamic narrative patches; Task 3 covers emotional renderer descriptors; Task 4 covers mixed reality sensor fallback; Task 5 covers AI co-creation editor planning; Task 6 covers integration and docs.
- Placeholder scan: no `TBD`, `TODO`, or “implement later” remains. Code examples use concrete class names and exact paths.
- Type consistency: all modules use the `25D` suffix and are exported from `src/livingworld/index.js` and `src/index.js`; editor wrappers use the same plan/preview names from the spec.
