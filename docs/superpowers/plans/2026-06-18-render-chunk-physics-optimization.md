# Render Chunk Physics Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Pixi sprite batch draw-call estimation/control, viewport-only tilemap chunk loading, and Matter-style physics query APIs for ray and circle scans.

**Architecture:** Keep renderer, tilemap, and physics changes isolated. PixiRenderer delegates batch analysis to a focused `BatchOptimizer`; ChunkManager owns lazy chunk hydration/unload; PhysicsAddon and PhysicsWorld expose the same query shape while using Matter.Query when available and geometry fallback otherwise.

**Tech Stack:** JavaScript ES modules, PixiJS v8, Vitest, existing OmniCore renderer/tilemap/physics modules.

---

### Task 1: Pixi Batch Optimizer

**Files:**
- Create: `src/renderer/BatchOptimizer.js`
- Modify: `src/renderer/PixiRenderer.js`
- Test: `tests/render-chunk-physics-optimization.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('merges one thousand same-atlas Pixi sprites into one estimated draw call', () => {
  const store = new Store();
  const renderer = new PixiRenderer({ store });
  renderer.stage = fakeStage();
  renderer.app = { stage: renderer.stage, renderer: { render: vi.fn() } };
  const scene = new Scene('batch');
  for (let index = 0; index < 1000; index += 1) {
    scene.add(new Sprite('atlas://terrain', { x: index % 50, y: Math.floor(index / 50), width: 16, height: 16 }));
  }
  renderer.renderScene(scene);
  expect(renderer.batchStats).toMatchObject({ drawCalls: 1, spriteCount: 1000, fpsTarget: 60 });
  expect(store.get('renderer:drawCalls')).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/render-chunk-physics-optimization.test.js`

Expected: FAIL because `batchStats` is missing.

- [ ] **Step 3: Implement minimal optimizer**

Create `BatchOptimizer` that groups Pixi sprite display objects by texture source, blend mode, shader/filter state, and atlas key. Wire it after `_applyStageOrder()` in `PixiRenderer`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/render-chunk-physics-optimization.test.js`

Expected: PASS for the batch test.

### Task 2: Tilemap Chunk Hydration And Unload

**Files:**
- Modify: `src/tilemap/ChunkManager.js`
- Modify: `src/tilemap/ChunkCache.js`
- Modify: `src/tilemap/Tilemap.js`
- Test: `tests/render-chunk-physics-optimization.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('loads only viewport chunks for a 100x100 map and unloads offscreen tile data', () => {
  const tilemap = Tilemap.parse({
    width: 100,
    height: 100,
    tilewidth: 16,
    tileheight: 16,
    layers: [{ id: 1, name: 'Ground', type: 'tilelayer', width: 100, height: 100, data: Array(10000).fill(1) }]
  });
  const manager = tilemap.createChunkManager({ chunkPixelSize: 160, unloadDistance: 0, collisionTileIds: [1] });
  const first = manager.update({ x: 0, y: 0, width: 160, height: 160 });
  const firstChunk = first[0];
  manager.update({ x: 1440, y: 1440, width: 160, height: 160 });
  expect(firstChunk.data).toBeNull();
  expect(manager.getRenderableTiles()).toHaveLength(100);
  expect(manager.getCollisionObjects()).toHaveLength(100);
  expect(manager.estimateMemoryBytes()).toBeLessThan(50 * 1024 * 1024);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/render-chunk-physics-optimization.test.js`

Expected: FAIL because chunks are metadata-only and lack render/collision/memory APIs.

- [ ] **Step 3: Implement lazy chunk payloads**

Hydrate only active chunk tile arrays, clear `chunk.data` when released, add `getRenderableTiles()`, `getCollisionObjects()`, `estimateMemoryBytes()`, and `Tilemap.createChunkManager()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/render-chunk-physics-optimization.test.js`

Expected: PASS for chunk behavior.

### Task 3: Physics Query API

**Files:**
- Modify: `src/lean/addons/Physics.js`
- Modify: `src/physics/PhysicsWorld.js`
- Test: `tests/render-chunk-physics-optimization.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('queries entities in front of the player with raycast and circle scans', () => {
  const physics = new PhysicsAddon({ matter: fakeMatter() }).mount();
  const enemyA = { id: 'enemy-a', x: 16, y: 0, width: 16, height: 16 };
  const enemyB = { id: 'enemy-b', x: 40, y: 0, width: 16, height: 16 };
  const farEnemy = { id: 'enemy-far', x: 80, y: 0, width: 16, height: 16 };
  physics.attachBody(enemyA);
  physics.attachBody(enemyB);
  physics.attachBody(farEnemy);
  expect(physics.query.raycast(0, 8, 48, 8)).toEqual([enemyA, enemyB]);
  expect(physics.query.circle(24, 8, 28)).toEqual([enemyA, enemyB]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/render-chunk-physics-optimization.test.js`

Expected: FAIL because `physics.query` is missing.

- [ ] **Step 3: Implement query facade**

Add `query.raycast()` and `query.circle()` to PhysicsAddon and PhysicsWorld. Use `Matter.Query.ray/region` when present and fallback to rectangle intersection math when not.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/render-chunk-physics-optimization.test.js`

Expected: PASS for query behavior.

### Task 4: Full Verification

**Files:**
- Modify: `docs/release-notes/render-chunk-physics-optimization.md`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- tests/render-chunk-physics-optimization.test.js`

Expected: PASS.

- [ ] **Step 2: Run full checks**

Run: `npm test`, `npm run lint`, `npm run build`.

Expected: all commands exit 0.

- [ ] **Step 3: Document changes**

Record batch, chunk, and query behavior in a release note with the verification commands.
