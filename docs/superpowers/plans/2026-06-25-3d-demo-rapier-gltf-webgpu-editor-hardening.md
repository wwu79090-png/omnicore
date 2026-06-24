# 3D Demo Rapier GLTF WebGPU Editor Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Turn the recent 3D/Rapier/WebGPU/editor adapter work into a clearer top-level product position and a runnable, inspectable 3D demo path.

**Architecture:** Keep Rapier as an optional dependency and expose a loader so default installs stay lightweight. Add a GLTF inspector and official 3D demo assets, then surface real-preview canvas mount state in the editor and WebGPU lifecycle snapshots.

**Tech Stack:** JavaScript ESM, Vitest, Three.js adapter, optional `@dimforge/rapier3d-compat`, existing editor package, README/API docs.

---

### Task 1: README Positioning

**Files:**
- Modify: `README.md`
- Test: `tests/3d-demo-rapier-gltf-editor-hardening.test.js`

- [x] **Step 1: Write failing test**

Assert README no longer says the engine is explicitly not full 3D at the top, and contains a capability matrix mentioning Runtime3DScene, ThreeRuntimeAdapter, RapierPhysicsBackend, WebGPUPipelineRuntime, and editor real-preview.

- [x] **Step 2: Run test**

Run: `npm test -- tests/3d-demo-rapier-gltf-editor-hardening.test.js`

- [x] **Step 3: Update README**

Replace the stale top-level limitation paragraph with a 2D-first plus production 3D path statement and matrix.

### Task 2: Official 3D Runtime Demo

**Files:**
- Create: `examples/3d-runtime-demo/package.json`
- Create: `examples/3d-runtime-demo/README.md`
- Create: `examples/3d-runtime-demo/index.html`
- Create: `examples/3d-runtime-demo/src/main.js`
- Create: `examples/3d-runtime-demo/assets/hero.gltf`
- Generate: `examples/3d-runtime-demo/assets/hero.glb`
- Test: `tests/3d-demo-rapier-gltf-editor-hardening.test.js`

- [x] **Step 1: Write failing test**

Assert the demo exists, imports Runtime3DScene, ThreeRuntimeAdapter, loadRapier3DCompatBackend, inspectGLTFAsset, and contains a binary GLB header.

- [x] **Step 2: Run test**

Expected: fail because demo files do not exist.

- [x] **Step 3: Add demo**

Create a small self-contained demo that uses GLTF/GLB assets, PBR material, directional shadow light, animation metadata, Rapier backend loader, collider debug draw, editor scene export JSON, and WebGPU snapshot reporting.

### Task 3: Rapier Compat Loader

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `packages/physics/src/RapierPhysicsBackend.js`
- Modify: `packages/physics/src/index.js`
- Test: `tests/3d-demo-rapier-gltf-editor-hardening.test.js`

- [x] **Step 1: Write failing test**

Assert `@dimforge/rapier3d-compat` is optional, `loadRapier3DCompatBackend()` is exported, and it can initialize an injected compat module.

- [x] **Step 2: Run test**

Expected: fail because optional dependency/loader is missing.

- [x] **Step 3: Add optional dependency and loader**

Add `@dimforge/rapier3d-compat` version `^0.19.3`, implement `loadRapier3DCompatBackend({ importRapier })`, and keep the backend injectable.

### Task 4: GLTF Asset Inspector

**Files:**
- Create: `src/dimension3d/GLTFAssetInspector.js`
- Modify: `src/index.js`
- Test: `tests/3d-demo-rapier-gltf-editor-hardening.test.js`

- [x] **Step 1: Write failing test**

Assert `inspectGLTFAsset()` reports file size, materials, texture issues, animation clips, skins, collider suggestions, LOD/compression recommendations, and repair actions.

- [x] **Step 2: Run test**

Expected: fail because inspector is missing.

- [x] **Step 3: Implement inspector**

Parse GLTF JSON-like documents and return deterministic diagnostics.

### Task 5: Editor Canvas Mount and E2E Contract

**Files:**
- Modify: `packages/omnicore-editor/src/panels/scene-3d-viewport-panel.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Create: `tests/e2e/3d-runtime-demo.spec.js`
- Test: `tests/3d-demo-rapier-gltf-editor-hardening.test.js`

- [x] **Step 1: Write failing test**

Assert real-preview state exposes a Three canvas mount contract and the editor DOM renders a `data-scene-3d-three-canvas` target.

- [x] **Step 2: Run test**

Expected: fail because canvas mount is not exposed.

- [x] **Step 3: Implement mount contract**

Add `canvasMount`, interaction controls, debug overlays, and E2E spec contract for opening the 3D demo, animation, Rapier debug draw, WebGPU fallback, and export.

### Task 6: Verification, Contract, Commit

**Files:**
- Modify: `tests/contract/golden/omnicore-core-api.json`
- Modify: `docs/api/index.html`
- Modify: `docs/api/manifest.json`

- [x] **Step 1: Update API contract**

Run `node scripts/contract/snapshot-api-contract.js --update`.

- [x] **Step 2: Run checks**

Run `npm run lint`, `npm run build`, `npm test`, and `git diff --check`.

- [x] **Step 3: Commit and push**

Commit as `feat(3d): add production demo and rapier gltf validation`, then push current branch.

## Self-Review

- Spec coverage: all user-listed gaps have a file and test target.
- Placeholder scan: no placeholder-only steps remain.
- Type consistency: public names are `loadRapier3DCompatBackend`, `inspectGLTFAsset`, and `createScene3DViewportRenderState().canvasMount`.
