# Engine Gap Closure Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the currently documented engine gaps into testable runtime/editor capabilities for 3D, physics, WebGPU diagnostics, VisualScript editor sessions, and recommended API paths.

**Architecture:** Add focused capability modules instead of expanding large existing files. `Scene3DKit` owns declarative 3D scene capability records; `PhysicsWorld` and backend contracts own collider/constraint/raycast/debug reports; `WebGPURenderer` owns resource lifecycle and frame budget diagnostics; `editor-app` exposes a serializable VisualScript editor session; `ApiSurfaceFocusLens` produces beginner-safe recommended paths.

**Tech Stack:** ESM JavaScript, Vitest, existing OmniCore editor package imports, no new external runtime dependencies in this batch.

---

### Task 1: Full 3D Scene Capability Kit

**Files:**
- Create: `src/dimension3d/Scene3DKit.js`
- Modify: `src/index.js`
- Test: `tests/engine-gap-closure-round2.test.js`

- [x] **Step 1: Write the failing test**

```js
const scene = new Scene3DKit({ name: 'hangar', width: 1280, height: 720 });
scene.setCamera({ id: 'gameplay', mode: 'free', controls: ['orbit', 'pointer-lock'] });
scene.addLight('sun', { type: 'directional', castShadow: true });
scene.addMaterial('hero-pbr', { type: 'pbr', normalMap: 'assets/hero_n.png' });
scene.addGLTFModel({ id: 'hero', url: 'models/hero.glb', material: 'hero-pbr', animations: ['Idle'], collider: { shape: 'capsule' }, rigidBody: { type: 'dynamic' } });
expect(scene.capabilities).toContain('full-3d-scene');
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run .\tests\engine-gap-closure-round2.test.js`
Expected: FAIL because `Scene3DKit` is not exported.

- [x] **Step 3: Implement the minimal capability kit**

Create a plain-data 3D scene manager with camera, light, PBR material, GLTF model, animation, postprocess, asset validation, and debug demo records.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run .\tests\engine-gap-closure-round2.test.js`
Expected: PASS for the 3D scene test.

### Task 2: Physics Backend Hardening

**Files:**
- Modify: `src/physics/backends/PhysicsBackend.js`
- Modify: `src/physics/PhysicsWorld.js`
- Test: `tests/engine-gap-closure-round2.test.js`

- [x] **Step 1: Write the failing test**

```js
const world = new PhysicsWorld();
await world.setBackend('rapier');
world.createRigidBody({ id: 'hero', collider: { shape: 'capsule', radius: 0.5, height: 2 } });
world.createConstraint({ id: 'door-hinge', type: 'revolute', bodyA: 'hero', bodyB: 'door' });
expect(world.raycast({ x: -10, y: 0 }, { x: 1, y: 0 }, 30).bodyId).toBe('hero');
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run .\tests\engine-gap-closure-round2.test.js`
Expected: FAIL because `createConstraint`, world-level `raycast`, debug draw, and backend capability reports are missing.

- [x] **Step 3: Implement backend-level bodies, colliders, constraints, raycast, and debug draw reports**

Extend normalized body state with collider/material/collision filter data, store constraints in the backend, and expose deterministic fallback raycast for bodies when native backend modules are absent.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run .\tests\engine-gap-closure-round2.test.js`
Expected: PASS for the physics test.

### Task 3: WebGPU Resource Lifecycle And Frame Budget Diagnostics

**Files:**
- Modify: `src/renderer/WebGPURenderer.js`
- Modify: `src/index.js`
- Test: `tests/engine-gap-closure-round2.test.js`

- [x] **Step 1: Write the failing test**

```js
const lifecycle = createWebGPUResourceLifecyclePlan({ currentFrame: 120, textures: [{ id: 'hero', sizeMB: 32, lastUsedFrame: 10 }] });
const frame = createWebGPUFrameBudgetReport({ frameBudgetMs: 16.6, passes: [{ name: 'render', ms: 18 }], deviceLost: true });
expect(lifecycle.toEvict).toContain('hero');
expect(frame.warnings).toContain('device-lost');
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run .\tests\engine-gap-closure-round2.test.js`
Expected: FAIL because the two diagnostic helpers are not exported.

- [x] **Step 3: Implement deterministic WebGPU planning helpers**

Add texture/buffer residency planning, memory-budget warnings, pipeline cache hit rate, frame budget warnings, and fallback recommendation output.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run .\tests\engine-gap-closure-round2.test.js`
Expected: PASS for the WebGPU diagnostics test.

### Task 4: VisualScript Editor Session Export

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/engine-gap-closure-round2.test.js`

- [x] **Step 1: Write the failing test**

```js
const session = app.EditorAPI.exportVisualScriptEditorSession({ includeTrace: true });
expect(session.palette.groups.map((group) => group.id)).toContain('flow');
expect(session.selectors.runStart).toBe('[data-visual-script-run="start"]');
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run .\tests\engine-gap-closure-round2.test.js`
Expected: FAIL because the editor API method is missing.

- [x] **Step 3: Implement serializable editor session export**

Return graph, validation, trace rows, beginner palette groups, run/validate selectors, and runtime status so E2E tests can assert the VisualScript surface without DOM scraping alone.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run .\tests\engine-gap-closure-round2.test.js`
Expected: PASS for the editor session test.

### Task 5: Recommended API Path

**Files:**
- Modify: `src/quality/ApiSurfaceFocusLens.js`
- Test: `tests/engine-gap-closure-round2.test.js`

- [x] **Step 1: Write the failing test**

```js
const path = new ApiSurfaceFocusLens().createRecommendedPath({
  target: '2d-platformer',
  experience: 'beginner',
  engines: ['phaser', 'godot', 'cocos']
});
expect(path.steps.map((step) => step.id)).toEqual(['template', 'runtime', 'editor', 'diagnostics', 'publish']);
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run .\tests\engine-gap-closure-round2.test.js`
Expected: FAIL because `createRecommendedPath` is missing.

- [x] **Step 3: Implement a stable recommendation path**

Produce template/runtime/editor/diagnostics/publish steps with recommended APIs and migration notes for Phaser, Godot, and Cocos users.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run .\tests\engine-gap-closure-round2.test.js`
Expected: PASS for the API path test.

### Task 6: Final Verification

**Files:**
- All files above.

- [x] **Step 1: Run focused tests**

Run: `npx vitest run .\tests\engine-gap-closure-round2.test.js .\tests\physics-backends.test.js .\tests\engine-quality-hardening.test.js .\tests\editor-deep-toolchain.test.js`
Expected: all selected tests pass with zero failures.

- [x] **Step 2: Run lint on touched files**

Run: `npx eslint -c .eslintrc.json --no-eslintrc src/dimension3d/Scene3DKit.js src/physics/PhysicsWorld.js src/physics/backends/PhysicsBackend.js src/renderer/WebGPURenderer.js src/quality/ApiSurfaceFocusLens.js packages/omnicore-editor/src/editor-app.js tests/engine-gap-closure-round2.test.js --ext .js`
Expected: exit code 0.

- [x] **Step 3: Run conflict and whitespace checks**

Run: `git diff --check`
Expected: exit code 0.
