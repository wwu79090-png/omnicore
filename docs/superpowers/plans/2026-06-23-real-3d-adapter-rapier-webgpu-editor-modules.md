# Real 3D Adapter Rapier WebGPU Editor Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the newest 3D, physics, WebGPU, and editor module contracts from descriptor-only infrastructure toward real runtime integration points.

**Architecture:** Add focused adapters that are usable with real libraries but testable through injected fakes. The Three.js adapter converts `Runtime3DScene` snapshots into Three scene objects and GLTF animation mixers, the Rapier backend wraps Rapier JS APIs behind the existing physics bridge, WebGPU renderer records its real frame lifecycle into `WebGPUPipelineRuntime`, and editor panel module wrappers begin moving large panel logic out of `editor-app.js`.

**Tech Stack:** JavaScript ESM, Vitest, Three.js dependency injection, Rapier JS dependency injection, existing OmniCore renderer/editor packages.

---

### Task 1: Three Runtime Adapter

**Files:**
- Create: `src/dimension3d/ThreeRuntimeAdapter.js`
- Modify: `src/index.js`
- Test: `tests/real-3d-rapier-webgpu-editor-modules.test.js`

- [x] **Step 1: Write the failing test**

Create a fake Three runtime and assert that `ThreeRuntimeAdapter.renderRuntimeScene(runtimeScene)` creates a scene, WebGLRenderer, PerspectiveCamera, DirectionalLight, MeshStandardMaterial, GLTF loader request, AnimationMixer, composer, shadows, and a render summary.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/real-3d-rapier-webgpu-editor-modules.test.js`

Expected: fail because `ThreeRuntimeAdapter` is not exported.

- [x] **Step 3: Write minimal implementation**

Implement `ThreeRuntimeAdapter` with injected `THREE`, `GLTFLoader`, `EffectComposer`, and `RenderPass`. Support `build(runtimeScene)`, `loadModels()`, `playAnimation()`, `renderFrame()`, and `createSnapshot()`.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/real-3d-rapier-webgpu-editor-modules.test.js`

Expected: Three adapter assertions pass.

### Task 2: Rapier Physics Backend

**Files:**
- Create: `packages/physics/src/RapierPhysicsBackend.js`
- Modify: `packages/physics/src/index.js`
- Test: `tests/real-3d-rapier-webgpu-editor-modules.test.js`

- [x] **Step 1: Write the failing test**

Use a fake Rapier module and assert that `createRapierPhysicsBackend()` delegates world creation, rigid body descriptors, collider descriptors, sensor flags, impulse joints, `step`, `castRay`, and `debugRender`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/real-3d-rapier-webgpu-editor-modules.test.js`

Expected: fail because `createRapierPhysicsBackend` is not exported.

- [x] **Step 3: Write minimal implementation**

Wrap Rapier JS behind the existing external backend contract: `createWorld`, `createRigidBody`, `createJoint`, `step`, `raycast`, and `debugDraw`.

- [x] **Step 4: Run physics regression**

Run: `npm test -- tests/real-3d-rapier-webgpu-editor-modules.test.js tests/physics-package-runtime.test.js`

Expected: pass with existing arcade behavior unchanged.

### Task 3: WebGPU Pipeline Runtime Inside Renderer

**Files:**
- Modify: `src/renderer/WebGPURenderer.js`
- Test: `tests/real-3d-rapier-webgpu-editor-modules.test.js`

- [x] **Step 1: Write the failing test**

Instantiate `WebGPURenderer` with a fake device and render a scene with textured children. Assert that `renderer.pipelineRuntime.createSnapshot()` records texture uploads, entity buffers, bind groups, pipeline cache, and an encoded draw command.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/real-3d-rapier-webgpu-editor-modules.test.js`

Expected: fail because `WebGPURenderer` does not expose or feed `pipelineRuntime`.

- [x] **Step 3: Write minimal implementation**

Create or accept a `WebGPUPipelineRuntime` in the renderer constructor. During init and render, record swapchain texture, entity buffer, frame bind group, sprite pipeline, texture uploads, draw encoding, and device lost recovery listener.

- [x] **Step 4: Run renderer regressions**

Run: `npm test -- tests/real-3d-rapier-webgpu-editor-modules.test.js tests/renderer-backends-mvp.test.js`

Expected: pass.

### Task 4: 3D Editor Viewport Real Render State

**Files:**
- Create: `packages/omnicore-editor/src/panels/scene-3d-viewport-panel.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/real-3d-rapier-webgpu-editor-modules.test.js`

- [x] **Step 1: Write the failing test**

Assert that opening the 3D viewport exposes `runtimeAdapter: 'three'`, `renderMode: 'real-preview'`, GLTF preload queue, active animation, material editability, light/shadow overlays, and collider overlays.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/real-3d-rapier-webgpu-editor-modules.test.js`

Expected: fail because the panel module and real-preview fields do not exist.

- [x] **Step 3: Write minimal implementation**

Extract `createScene3DViewportRenderState()` to the panel module and call it from `openScene3DViewport()`. Keep DOM rendering behavior stable.

- [x] **Step 4: Run editor regressions**

Run: `npm test -- tests/real-3d-rapier-webgpu-editor-modules.test.js tests/editor-deep-toolchain.test.js`

Expected: pass.

### Task 5: Docs, API Contract, and Verification

**Files:**
- Modify: `README.md`
- Modify: `tests/contract/golden/omnicore-core-api.json`
- Modify: `docs/api/index.html`
- Modify: `docs/api/manifest.json`

- [x] **Step 1: Update docs and API contract**

Document `ThreeRuntimeAdapter`, `createRapierPhysicsBackend`, WebGPU renderer `pipelineRuntime`, and editor 3D real-preview state. Run `node scripts/contract/snapshot-api-contract.js --update` after public exports are final.

- [x] **Step 2: Run targeted checks**

Run:

```powershell
npm test -- tests/real-3d-rapier-webgpu-editor-modules.test.js tests/runtime-3d-webgpu-backends.test.js tests/physics-package-runtime.test.js tests/editor-deep-toolchain.test.js tests/renderer-backends-mvp.test.js
```

- [x] **Step 3: Run full gates**

Run:

```powershell
npm run lint
npm run build
npm test
git diff --check
```

- [x] **Step 4: Commit and push**

Run:

```powershell
git add .
git commit -m "feat(runtime): connect real 3d rapier webgpu adapters"
git push
```

Expected: branch `codex/contract-benchmark-ci` pushed.

## Self-Review

- Spec coverage: each requested area maps to a tested adapter or module boundary.
- Placeholder scan: no placeholder steps are used.
- Type consistency: exported names are `ThreeRuntimeAdapter`, `createRapierPhysicsBackend`, `RapierPhysicsBackend`, and `createScene3DViewportRenderState`.
