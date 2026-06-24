# Real 3D Editor Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move OmniCore's 3D editor path from data contracts into a real runtime layer that can mount Three.js, visualize Rapier debug draw, import GLB files, execute a WebGPU hardware path, expose an EXE E2E contract, and ship a playable 3D template.

**Architecture:** Add focused helper modules instead of growing `editor-app.js`: a Three viewport runtime for OrbitControls/TransformControls/Raycaster, a Rapier debug draw visualizer, a GLB file importer, a WebGPU hardware runner, and a 3D template manifest. Wire only summarized state into the existing desktop launcher and demo page.

**Tech Stack:** JavaScript ESM, Vitest, Playwright, Three.js, Rapier JS, WebGPU browser API, existing OmniCore editor app.

---

### Task 1: Real Three Viewport Runtime

**Files:**
- Create: `packages/omnicore-editor/src/panels/scene-3d-three-runtime.js`
- Modify: `packages/omnicore-editor/src/panels/scene-3d-viewport-panel.js`
- Test: `tests/3d-editor-real-runtime-template.test.js`

- [x] **Step 1: Write the failing test**

Assert `createScene3DThreeRuntime()` creates a real renderer, scene, camera, OrbitControls, TransformControls, Raycaster, selection, drag transform, material edit, and animation switch using injected Three-compatible classes.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/3d-editor-real-runtime-template.test.js`
Expected: fail because the runtime module does not exist.

- [x] **Step 3: Implement runtime**

Create the module with `mount()`, `selectByPointer()`, `dragSelected()`, `editMaterial()`, `switchAnimation()`, `renderFrame()`, and `createSnapshot()`.

### Task 2: Rapier Debug Draw Visualization

**Files:**
- Create: `src/dimension3d/RapierDebugDrawVisualizer.js`
- Modify: `src/index.js`
- Test: `tests/3d-editor-real-runtime-template.test.js`

- [x] **Step 1: Write the failing test**

Assert debug draw buffers, colliders, sensors, joints, and raycast hits become visual line/box descriptors and optional Three line objects.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/3d-editor-real-runtime-template.test.js`
Expected: fail because `createRapierDebugDrawVisualization` is not exported.

- [x] **Step 3: Implement visualizer**

Convert Rapier debug draw payloads into deterministic overlay descriptors and optional injected Three objects.

### Task 3: GLB/GLTF Real File Import

**Files:**
- Create: `src/dimension3d/GLBFileImporter.js`
- Modify: `src/index.js`
- Test: `tests/3d-editor-real-runtime-template.test.js`

- [x] **Step 1: Write the failing test**

Assert `importGLBFile()` reads an ArrayBuffer, validates the `glTF` GLB header, parses the JSON chunk, creates an inspection report, thumbnail descriptor, collider, resource record, and scene patch.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/3d-editor-real-runtime-template.test.js`
Expected: fail because `importGLBFile` is not exported.

- [x] **Step 3: Implement importer**

Parse GLB chunks with `DataView`, decode JSON, call `createGLTFImportWorkflow()`, and return editor-ready import data.

### Task 4: WebGPU Hardware Runner

**Files:**
- Create: `src/renderer/WebGPUHardwareRunner.js`
- Modify: `src/index.js`
- Test: `tests/3d-editor-real-runtime-template.test.js`

- [x] **Step 1: Write the failing test**

Assert `runWebGPUHardwarePath()` calls `navigator.gpu.requestAdapter()`, `adapter.requestDevice()`, creates texture/buffer/command encoder/render pass, submits commands, observes `device.lost`, and returns a validation report.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/3d-editor-real-runtime-template.test.js`
Expected: fail because `runWebGPUHardwarePath` is not exported.

- [x] **Step 3: Implement runner**

Use injected browser GPU objects so the unit test can verify real API call order without requiring physical GPU hardware.

### Task 5: EXE E2E Contract and 3D Template

**Files:**
- Create: `examples/template-3d-playable/package.json`
- Create: `examples/template-3d-playable/scene.omnicore.json`
- Create: `examples/template-3d-playable/src/main.js`
- Create: `tests/e2e/electron-3d-editor-contract.spec.js`
- Modify: `package.json`
- Test: `tests/3d-editor-real-runtime-template.test.js`

- [x] **Step 1: Write the failing test**

Assert the 3D template has third-person camera, character controller, Rapier ground collision, pickup object, animation switching, and export config. Assert the Electron E2E contract covers launching EXE, opening 3D demo, importing GLB, editing, saving, and exporting.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/3d-editor-real-runtime-template.test.js`
Expected: fail because the template and E2E contract do not exist.

- [x] **Step 3: Add template and contract**

Create a lightweight template and a Playwright Electron contract spec that documents the executable desktop flow.

### Task 6: Verification and Commit

**Files:**
- Modify: `docs/api/index.html`
- Modify: `docs/api/manifest.json`
- Modify: `tests/contract/golden/omnicore-core-api.json`

- [x] **Step 1: Update API contract**

Run: `node scripts/contract/snapshot-api-contract.js --update` and `node scripts/generate-api-docs.js --out docs/api`.

- [x] **Step 2: Run checks**

Run `npm run lint`, `npm run build`, `npm test`, `npx playwright test tests/e2e/3d-runtime-demo.spec.js --project=chromium`, and `git diff --check`.

- [x] **Step 3: Commit and push**

Commit as `feat(3d): add real editor runtime adapters`, then push current branch.

## Self-Review

- Spec coverage: covers real Three runtime, Rapier debug draw visualization, real GLB parsing/import, WebGPU hardware execution path, EXE E2E contract, editor module split, and 3D playable template.
- Placeholder scan: no TBD or undefined steps remain.
- Type consistency: public names are `createScene3DThreeRuntime`, `createRapierDebugDrawVisualization`, `importGLBFile`, and `runWebGPUHardwarePath`.
