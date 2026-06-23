# Runtime 3D WebGPU Physics Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a concrete runtime hardening increment for 3D authoring, WebGPU resource/command lifecycle, external Rapier/Box2D style physics backends, and editor authoring module boundaries.

**Architecture:** Keep this as descriptor-backed runtime infrastructure rather than claiming a full native renderer/solver in one pass. New focused modules expose stable scene, WebGPU, physics-backend, and editor-authoring contracts that existing diagnostics and future UI panels can consume.

**Tech Stack:** JavaScript ESM, Vitest, existing OmniCore source layout, `@omnicore/physics`, and the desktop editor package.

---

### Task 1: Runtime 3D Scene Contract

**Files:**
- Create: `src/dimension3d/Runtime3DScene.js`
- Modify: `src/index.js`
- Test: `tests/runtime-3d-webgpu-backends.test.js`

- [x] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { Runtime3DScene } from '../src/index.js';

it('creates a runnable 3D scene snapshot with camera controls, lights, PBR, GLTF animation, colliders, and physics binding', () => {
  const scene = new Runtime3DScene({ name: 'arena' });
  scene.addCamera({ id: 'main-camera', mode: 'free', controls: ['orbit', 'wasd'] });
  scene.addLight({ id: 'sun', type: 'directional', castShadow: true });
  scene.addPBRMaterial('hero-mat', { baseColor: '#88ccff', metallic: 0.2, roughness: 0.45 });
  scene.addGLTFModel({
    id: 'hero',
    url: 'assets/hero.glb',
    material: 'hero-mat',
    animations: ['Idle', 'Run'],
    collider: { shape: 'capsule', radius: 0.35, height: 1.8 },
    rigidBody: { type: 'dynamic', mass: 1 }
  });
  scene.playAnimation('hero', 'Run');
  scene.bindPhysicsBody('hero', { backend: 'rapier', bodyId: 'rb-hero' });

  const snapshot = scene.createRuntimeSnapshot();

  expect(snapshot.schema).toBe('omnicore.runtime-3d-scene.v1');
  expect(snapshot.summary).toMatchObject({
    cameraCount: 1,
    lightCount: 1,
    pbrMaterialCount: 1,
    gltfModelCount: 1,
    animatedModelCount: 1,
    colliderCount: 1,
    physicsBindingCount: 1,
    shadowCasterCount: 1
  });
  expect(snapshot.models[0]).toMatchObject({
    id: 'hero',
    activeAnimation: 'Run',
    physicsBinding: { backend: 'rapier', bodyId: 'rb-hero' }
  });
  expect(snapshot.debugDraw.colliders[0]).toMatchObject({ modelId: 'hero', shape: 'capsule' });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/runtime-3d-webgpu-backends.test.js`

Expected: fail because `Runtime3DScene` is not exported.

- [x] **Step 3: Write minimal implementation**

Create `Runtime3DScene` with methods `addCamera`, `addLight`, `addPBRMaterial`, `addGLTFModel`, `playAnimation`, `bindPhysicsBody`, `createRuntimeSnapshot`, and `createDebugDraw`. Export it from `src/index.js`.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/runtime-3d-webgpu-backends.test.js`

Expected: pass with no console warnings.

### Task 2: WebGPU Pipeline Runtime Contract

**Files:**
- Create: `src/renderer/WebGPUPipelineRuntime.js`
- Modify: `src/index.js`
- Test: `tests/runtime-3d-webgpu-backends.test.js`

- [x] **Step 1: Write the failing test**

```js
import { WebGPUPipelineRuntime } from '../src/index.js';

it('tracks real WebGPU-style uploads, buffers, bind groups, pipeline cache, command encoding, and device recovery', () => {
  const runtime = new WebGPUPipelineRuntime({ label: 'main-frame' });
  runtime.createTexture({ id: 'hero-atlas', width: 256, height: 256, format: 'rgba8unorm' });
  runtime.queueTextureUpload('hero-atlas', { bytes: 256 * 256 * 4, source: 'assets/hero.png' });
  runtime.flushTextureUploads();
  runtime.createBuffer({ id: 'camera-uniforms', size: 128, usage: 'uniform' });
  runtime.createBindGroup({ id: 'frame-bindings', resources: ['hero-atlas', 'camera-uniforms'] });
  runtime.createPipeline({ id: 'pbr-forward', layout: 'frame-bindings', vertex: 'vs_main', fragment: 'fs_main' });
  runtime.encodeDraw({ pipeline: 'pbr-forward', bindGroup: 'frame-bindings', vertexCount: 36, instanceCount: 2 });
  runtime.loseDevice('adapter-reset');
  runtime.recoverDevice({ strategy: 'recreate-device' });

  const snapshot = runtime.createSnapshot();

  expect(snapshot.schema).toBe('omnicore.webgpu-pipeline-runtime.v1');
  expect(snapshot.summary).toMatchObject({
    textureCount: 1,
    uploadedTextureCount: 1,
    bufferCount: 1,
    bindGroupCount: 1,
    pipelineCount: 1,
    commandCount: 1,
    recoveryCount: 1,
    deviceLost: false
  });
  expect(snapshot.commandBuffers[0]).toMatchObject({ encoded: true, drawCalls: 1 });
  expect(snapshot.pipelineCache[0]).toMatchObject({ id: 'pbr-forward', hits: 1 });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/runtime-3d-webgpu-backends.test.js`

Expected: fail because `WebGPUPipelineRuntime` is not exported.

- [x] **Step 3: Write minimal implementation**

Create a deterministic descriptor runtime with texture upload states, buffer records, bind group validation, pipeline cache hit counts, encoded command buffers, and device-lost recovery records.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/runtime-3d-webgpu-backends.test.js`

Expected: pass with no warnings.

### Task 3: External Rapier / Box2D Backend Bridge

**Files:**
- Modify: `packages/physics/src/index.js`
- Test: `tests/runtime-3d-webgpu-backends.test.js`

- [x] **Step 1: Write the failing test**

```js
import { createExternalPhysicsBackend, createPhysicsWorld } from '@omnicore/physics';

it('delegates bodies, sensors, joints, raycast, debug draw, and step calls to real backend modules', () => {
  const calls = [];
  const fakeRapier = {
    createWorld({ gravity }) {
      calls.push(['createWorld', gravity]);
      return { id: 'rapier-world' };
    },
    createRigidBody(world, body) {
      calls.push(['createRigidBody', world.id, body.id, body.type]);
      return { handle: `rb:${body.id}` };
    },
    createJoint(world, joint) {
      calls.push(['createJoint', world.id, joint.id]);
      return { handle: `joint:${joint.id}` };
    },
    step(world, delta) {
      calls.push(['step', world.id, delta]);
      return { contacts: [{ bodyA: 'hero', bodyB: 'crate' }], sensors: [{ sensorId: 'trigger', bodyId: 'hero' }] };
    },
    raycast(world, ray) {
      calls.push(['raycast', world.id, ray.maxDistance]);
      return { bodyId: 'hero', distance: 3, point: { x: 3, y: 0 } };
    },
    debugDraw(world) {
      calls.push(['debugDraw', world.id]);
      return { colliders: [{ id: 'hero', shape: 'box' }], constraints: [{ id: 'rope', type: 'distance' }] };
    }
  };

  const world = createPhysicsWorld({
    backend: 'rapier-real',
    backends: [createExternalPhysicsBackend('rapier-real', { module: fakeRapier, kind: 'rapier' })]
  });
  world.addBody({ id: 'hero', type: 'dynamic', width: 8, height: 8 });
  world.addSensor({ id: 'trigger', width: 4, height: 4 });
  world.addConstraint({ id: 'rope', bodyA: 'hero', bodyB: 'trigger', type: 'distance' });

  const step = world.step(1 / 60);
  const hit = world.raycast({ x: 0, y: 0 }, { x: 1, y: 0 }, 16);
  const snapshot = world.createDiagnosticsSnapshot();

  expect(step).toMatchObject({ backend: 'rapier-real', contacts: [{ bodyA: 'hero', bodyB: 'crate' }] });
  expect(hit).toMatchObject({ bodyId: 'hero', distance: 3 });
  expect(snapshot.debugDraw).toMatchObject({
    colliders: [{ id: 'hero', shape: 'box' }],
    constraints: [{ id: 'rope', type: 'distance' }]
  });
  expect(calls.map((call) => call[0])).toEqual(expect.arrayContaining([
    'createWorld',
    'createRigidBody',
    'createJoint',
    'step',
    'raycast',
    'debugDraw'
  ]));
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/runtime-3d-webgpu-backends.test.js`

Expected: fail because `createExternalPhysicsBackend` does not exist.

- [x] **Step 3: Write minimal implementation**

Add `createExternalPhysicsBackend`, external backend runtime world creation, body/joint delegation, raycast delegation, debug draw delegation, and diagnostics summary compatibility.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/runtime-3d-webgpu-backends.test.js tests/physics-package-runtime.test.js`

Expected: both pass with existing arcade behavior unchanged.

### Task 4: Editor Authoring Module Boundary

**Files:**
- Create: `packages/omnicore-editor/src/editor-authoring-modules.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/runtime-3d-webgpu-backends.test.js`

- [x] **Step 1: Write the failing test**

```js
import { createEditorAuthoringModules } from 'omnicore-editor/src/editor-authoring-modules.js';

it('exposes editor authoring modules so large panels can move out of editor-app.js', () => {
  const modules = createEditorAuthoringModules();

  expect(Object.keys(modules)).toEqual([
    'visualScript',
    'scene3DViewport',
    'prefabDependencyGraph',
    'webgpuPipeline',
    'dockWindow',
    'runtimeSync'
  ]);
  expect(modules.visualScript.panels).toContain('visual-scripting');
  expect(modules.scene3DViewport.capabilities).toContain('camera3d-preview');
  expect(modules.webgpuPipeline.capabilities).toContain('device-lost-recovery');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/runtime-3d-webgpu-backends.test.js`

Expected: fail because `editor-authoring-modules.js` does not exist.

- [x] **Step 3: Write minimal implementation**

Create module descriptors and import them in `editor-app.js`. Expose `getAuthoringModules()` from `createEditorApp()` so tests and runtime-sync code can inspect panel ownership.

- [x] **Step 4: Run tests**

Run: `npm test -- tests/runtime-3d-webgpu-backends.test.js tests/editor-deep-toolchain.test.js`

Expected: pass with existing editor behavior unchanged.

### Task 5: Docs and Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-23-runtime-3d-webgpu-physics-modularization.md`

- [x] **Step 1: Document new runtime contracts**

Add README notes for `Runtime3DScene`, `WebGPUPipelineRuntime`, `createExternalPhysicsBackend`, and editor authoring modules.

- [x] **Step 2: Run targeted verification**

Run:

```powershell
npm test -- tests/runtime-3d-webgpu-backends.test.js tests/physics-package-runtime.test.js tests/editor-deep-toolchain.test.js
```

Expected: pass.

- [x] **Step 3: Run full quality gates**

Run:

```powershell
npm run lint
npm run build
npm test
git diff --check
```

Expected: all pass without warnings.

- [x] **Step 4: Commit and push**

Run:

```powershell
git add src/dimension3d/Runtime3DScene.js src/renderer/WebGPUPipelineRuntime.js src/index.js packages/physics/src/index.js packages/omnicore-editor/src/editor-authoring-modules.js packages/omnicore-editor/src/editor-app.js tests/runtime-3d-webgpu-backends.test.js README.md docs/superpowers/plans/2026-06-23-runtime-3d-webgpu-physics-modularization.md
git commit -m "feat(runtime): harden 3d webgpu physics authoring"
git push
```

Expected: branch `codex/contract-benchmark-ci` pushed to origin.

## Self-Review

- Spec coverage: 3D runtime, WebGPU pipeline, external Rapier/Box2D backend bridge, and editor architecture split each has a task and a test.
- Placeholder scan: no TBD/TODO/fill-in steps remain.
- Type consistency: public names are `Runtime3DScene`, `WebGPUPipelineRuntime`, `createExternalPhysicsBackend`, and `createEditorAuthoringModules`.
