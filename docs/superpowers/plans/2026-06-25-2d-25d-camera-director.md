# 2D/2.5D Camera Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production camera director for 2D/2.5D games that unifies deadzone follow, lookahead, room bounds, shake, parallax, pixel snapping, editor controls, runtime sync, and debug draw.

**Architecture:** Implement a pure data planner in `src/camera/Camera2D25DDirector.js` so runtime, editor, demo, and tests can consume the same camera step. It should complement the existing mutable `Camera` utility without replacing it.

**Tech Stack:** JavaScript ES modules, Vitest, existing 2D/2.5D platformer demo and public API contract snapshots.

---

### Task 1: Failing Camera Director Contract Test

**Files:**
- Create: `tests/camera-2d-25d-director.test.js`
- Modify later: `src/camera/Camera2D25DDirector.js`
- Modify later: `src/index.js`
- Modify later: `examples/2d-25d-platformer-demo/src/main.js`
- Modify later: `examples/2d-25d-platformer-demo/README.md`

- [x] **Step 1: Write the failing test**

```js
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CAMERA_2D_25D_DIRECTOR_SCHEMA,
  createCamera2D25DDirectorStep
} from '../src/index.js';

describe('2D/2.5D camera director', () => {
  it('builds a production camera step with deadzone, lookahead, room bounds, shake, parallax, debug, editor, and runtime sync', () => {
    const step = createCamera2D25DDirectorStep({
      delta: 1 / 60,
      camera: {
        x: 120,
        y: 40,
        viewport: { width: 160, height: 96 },
        zoom: 1,
        pixelSnap: true
      },
      target: {
        id: 'hero',
        x: 210,
        y: 74,
        width: 16,
        height: 24,
        velocity: { x: 140, y: -40 },
        lookAhead: { x: 36, y: -8 }
      },
      rooms: [
        { id: 'room-a', x: 0, y: 0, width: 240, height: 144 },
        { id: 'room-b', x: 240, y: 0, width: 240, height: 144, transition: 'push' }
      ],
      deadzone: { x: 56, y: 28, width: 48, height: 36 },
      smoothing: { follow: 0.5, lookAhead: 1 },
      shake: { trauma: 0.5, decay: 0.1, maxOffset: 12, seed: 4 },
      parallax: [
        { id: 'sky', factorX: 0.25, factorY: 0.1, offsetX: 4 },
        { id: 'mid', factorX: 0.6, factorY: 0.35 }
      ]
    });

    expect(step.schema).toBe(CAMERA_2D_25D_DIRECTOR_SCHEMA);
    expect(step.target).toMatchObject({ id: 'hero', center: { x: 218, y: 86 } });
    expect(step.room).toMatchObject({ activeRoomId: 'room-b', transition: 'push' });
    expect(step.view).toMatchObject({ x: 240, y: 12, width: 160, height: 96, zoom: 1 });
    expect(step.deadzone.world).toMatchObject({ x: 296, y: 40, width: 48, height: 36 });
    expect(step.shake).toMatchObject({ active: true, trauma: 0.5, nextTrauma: 0.4 });
    expect(step.shake.offset.x).not.toBe(0);
    expect(step.parallax.layers).toEqual([
      expect.objectContaining({ id: 'sky', x: -56, y: -1.2 }),
      expect.objectContaining({ id: 'mid', x: -144, y: -4.2 })
    ]);
    expect(step.editor.panels).toEqual(expect.arrayContaining([
      'CameraDirector',
      'Deadzone',
      'LookAhead',
      'RoomBounds',
      'ShakeTrauma',
      'ParallaxLayers',
      'PixelSnap',
      'RuntimeDebug'
    ]));
    expect(step.runtimeSync.payloads).toEqual(expect.arrayContaining([
      'camera',
      'target',
      'room',
      'deadzone',
      'shake',
      'parallax'
    ]));
    expect(step.debugDraw.map((command) => command.op)).toEqual(expect.arrayContaining([
      'debug:camera-view',
      'debug:camera-deadzone',
      'debug:camera-room',
      'debug:camera-lookahead',
      'debug:camera-shake',
      'debug:camera-parallax-layer'
    ]));
    expect(step.quality.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'camera-room-bounds', pass: true }),
      expect.objectContaining({ id: 'camera-deadzone-follow', pass: true }),
      expect.objectContaining({ id: 'camera-shake-trauma', pass: true }),
      expect.objectContaining({ id: 'camera-parallax-layers', pass: true }),
      expect.objectContaining({ id: 'camera-editor-runtime-sync', pass: true })
    ]));
  });

  it('is wired into the official 2D/2.5D platformer demo', () => {
    const root = join(process.cwd(), 'examples/2d-25d-platformer-demo');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    const readme = readFileSync(join(root, 'README.md'), 'utf8');

    expect(main).toContain('createCamera2D25DDirectorStep');
    expect(main).toContain('CameraDirector');
    expect(main).toContain('ParallaxLayers');
    expect(main).toContain('ShakeTrauma');
    expect(readme).toContain('camera director');
    expect(readme).toContain('deadzone');
    expect(readme).toContain('parallax');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/camera-2d-25d-director.test.js`
Expected: FAIL because the public API and demo integration do not exist yet.

### Task 2: Camera Director Runtime

**Files:**
- Create: `src/camera/Camera2D25DDirector.js`
- Modify: `src/index.js`
- Test: `tests/camera-2d-25d-director.test.js`

- [ ] **Step 1: Implement the pure camera step**

The camera step must normalize camera/target/rooms, resolve active room, apply lookahead, deadzone correction, smoothing, bounds clamp, pixel snap, deterministic shake, parallax transforms, editor panels, runtime sync, debug commands, and quality checks.

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/camera-2d-25d-director.test.js`
Expected: PASS.

### Task 3: Official Demo Integration

**Files:**
- Modify: `examples/2d-25d-platformer-demo/src/main.js`
- Modify: `examples/2d-25d-platformer-demo/README.md`
- Test: `tests/camera-2d-25d-director.test.js`

- [ ] **Step 1: Feed the demo camera from the director**

The demo should build a camera director step every frame from the hero and controller hints, store it in `debugOverlay.cameraDirector`, and display camera director panel labels in the debug overlay.

- [ ] **Step 2: Run focused regression**

Run: `npm test -- tests/camera-2d-25d-director.test.js tests/platformer-2d-controller.test.js tests/level-2d-25d-gameplay-loop.test.js`
Expected: PASS.

### Task 4: Verification, Docs, Contract, Commit

**Files:**
- Modify generated docs if required: `docs/api/index.html`
- Modify generated docs if required: `docs/api/manifest.json`
- Modify contract if required: `tests/contract/golden/omnicore-core-api.json`

- [ ] **Step 1: Run regression commands**

Run:
`npm test -- tests/camera-2d-25d-director.test.js tests/platformer-2d-controller.test.js tests/level-2d-25d-gameplay-loop.test.js tests/tilemap-2d-25d-authoring-loop.test.js tests/arcade-2d-gameplay-hardening.test.js tests/scene-2d-25d-runtime-editor-closure.test.js`
`npm run lint`
`npm run build`
`npm run docs:generate`
`npm test -- tests/contract/api-contract-snapshot.test.js`
`git diff --check`

- [ ] **Step 2: Commit and push**

Run:
`git add src/camera/Camera2D25DDirector.js src/index.js tests/camera-2d-25d-director.test.js examples/2d-25d-platformer-demo/src/main.js examples/2d-25d-platformer-demo/README.md docs/superpowers/plans/2026-06-25-2d-25d-camera-director.md docs/api/index.html docs/api/manifest.json tests/contract/golden/omnicore-core-api.json`
`git commit -m "feat(2d): add camera director"`
`git push origin codex/contract-benchmark-ci`
