# 3D Editor Operability Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the existing 3D runtime demo and editor 3D real-preview path actionable: orbit/select/drag/material/animation/collider toggles, real Rapier simulation evidence, GLTF import UI state, WebGPU hardware validation, launcher demo integration, and E2E flow coverage.

**Architecture:** Add focused modules for 3D editor interaction, GLTF import workflow, and WebGPU hardware validation, then wire their summarized state into the existing editor panel and 3D demo. Keep Rapier optional and dependency-injected while exercising true world/body/collider/sensor/joint/raycast/debugRender calls in tests and demo evidence.

**Tech Stack:** JavaScript ESM, Vitest, Playwright, Three.js, optional `@dimforge/rapier3d-compat`, existing OmniCore editor app, existing WebGPUPipelineRuntime.

---

### Task 1: 3D Viewport Interaction State

**Files:**
- Create: `packages/omnicore-editor/src/panels/scene-3d-interaction-runtime.js`
- Modify: `packages/omnicore-editor/src/panels/scene-3d-viewport-panel.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/3d-editor-operability-loop.test.js`

- [x] **Step 1: Write the failing test**

Assert a real-preview state exposes orbit, select, drag, material edit, animation switch, and collider visibility actions with deterministic patches and trace entries.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/3d-editor-operability-loop.test.js`
Expected: fail because `createScene3DInteractionRuntime` is not exported.

- [x] **Step 3: Implement interaction runtime**

Create a focused module that stores camera orbit state, selected model id, drag transform patch, material patch, active animation, collider overlay visibility, and trace.

- [x] **Step 4: Wire editor rendering**

Expose interaction actions through `createScene3DViewportRenderState()` and render them in the DOM under `[data-scene-3d-interaction-tools]`.

### Task 2: Real Rapier Runtime Demo Evidence

**Files:**
- Modify: `packages/physics/src/RapierPhysicsBackend.js`
- Modify: `examples/3d-runtime-demo/src/main.js`
- Test: `tests/3d-editor-operability-loop.test.js`

- [x] **Step 1: Write the failing test**

Assert the Rapier backend can run a true world simulation: dynamic body falls, static floor collides, sensor is registered, fixed joint is created, raycast hits, and debug draw returns vertices/colliders/constraints.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/3d-editor-operability-loop.test.js`
Expected: fail because there is no `runSimulationDemo()` helper.

- [x] **Step 3: Implement simulation helper**

Add `runSimulationDemo()` to the Rapier backend module using existing backend methods and injected/fake-compatible Rapier API.

- [x] **Step 4: Surface demo evidence**

Use the helper from the 3D runtime demo report so the page shows falling body, collision/sensor/joint/raycast/debug draw evidence.

### Task 3: GLTF Import Workflow

**Files:**
- Create: `src/dimension3d/GLTFImportWorkflow.js`
- Modify: `src/index.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/3d-editor-operability-loop.test.js`

- [x] **Step 1: Write the failing test**

Assert a dropped GLB/GLTF file produces an import workflow report with inspection summary, repair actions, generated collider, LOD/compression suggestions, and one-click scene insertion patch.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/3d-editor-operability-loop.test.js`
Expected: fail because `createGLTFImportWorkflow` is not exported.

- [x] **Step 3: Implement workflow**

Wrap `inspectGLTFAsset()` and create deterministic UI/workflow state for dropzone, inspector, repair plan, and scene insertion.

- [x] **Step 4: Wire editor import panel**

Render a GLTF import workflow section for the desktop `gltf-import` command window.

### Task 4: WebGPU Hardware Validation

**Files:**
- Create: `src/renderer/WebGPUHardwareValidation.js`
- Modify: `src/index.js`
- Modify: `examples/3d-runtime-demo/src/main.js`
- Test: `tests/3d-editor-operability-loop.test.js`

- [x] **Step 1: Write the failing test**

Assert the validator reports WebGPU success path, WebGL fallback, device lost recovery, multiple browser records, and resource lifecycle snapshot linkage.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/3d-editor-operability-loop.test.js`
Expected: fail because `createWebGPUHardwareValidationReport` is not exported.

- [x] **Step 3: Implement validator**

Create a pure helper that accepts adapter/browser samples and a `WebGPUPipelineRuntime` snapshot, then outputs a deterministic report.

- [x] **Step 4: Surface demo report**

Add the report to the 3D runtime demo evidence panel.

### Task 5: EXE Launcher 3D Demo Integration and E2E

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `tests/desktop-editor-packaging.test.js`
- Modify: `tests/e2e/3d-runtime-demo.spec.js`
- Test: `tests/desktop-editor-packaging.test.js`
- Test: `tests/e2e/3d-runtime-demo.spec.js`

- [x] **Step 1: Write the failing tests**

Assert the desktop launcher 3D command opens the official `examples/3d-runtime-demo`, offers open/run/edit/export actions, and the E2E page exposes model import, animation, Rapier, debug draw, WebGPU fallback, and export evidence.

- [x] **Step 2: Run the tests**

Run: `npm test -- tests/desktop-editor-packaging.test.js tests/3d-editor-operability-loop.test.js`
Expected: fail until command window details are wired.

- [x] **Step 3: Implement launcher details**

Upgrade the `scene-3d-demo` command details so the EXE launcher has direct official demo actions and editor state wiring.

- [x] **Step 4: Run browser smoke**

Run: `npx playwright test tests/e2e/3d-runtime-demo.spec.js --project=chromium`
Expected: pass with only known external WebGL driver warning filtered.

### Task 6: Verification and Commit

**Files:**
- Modify: `tests/contract/golden/omnicore-core-api.json`
- Modify: `docs/api/index.html`
- Modify: `docs/api/manifest.json`

- [x] **Step 1: Update API contract**

Run: `node scripts/contract/snapshot-api-contract.js --update`.

- [x] **Step 2: Run checks**

Run `npm run lint`, `npm run build`, `npm test`, `npx playwright test tests/e2e/3d-runtime-demo.spec.js --project=chromium`, and `git diff --check`.

- [x] **Step 3: Commit and push**

Commit as `feat(editor): complete 3d operability loop`, then push current branch.

## Self-Review

- Spec coverage: covers editor interactions, Rapier true demo evidence, GLTF import UI workflow, WebGPU hardware validation, EXE demo entry, module split, and E2E flow.
- Placeholder scan: no TBD or undefined follow-up steps remain.
- Type consistency: public names are `createScene3DInteractionRuntime`, `runRapierSimulationDemo`, `createGLTFImportWorkflow`, and `createWebGPUHardwareValidationReport`.
