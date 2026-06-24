# 3D Editor Runtime Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the separate 3D editor adapters into a single editor session that can mount a real Three viewport, import GLB files, visualize Rapier debug draw, capture WebGPU hardware status, and produce save/export patches.

**Architecture:** Add a focused editor panel module instead of growing `editor-app.js`. The session receives injected dependencies for core runtime operations so unit tests can exercise the real control flow without launching Electron or requiring GPU hardware.

**Tech Stack:** JavaScript ESM, Vitest, OmniCore editor panel modules, Three-compatible injected classes, GLB importer, Rapier debug draw visualizer, WebGPU hardware runner.

---

### Task 1: Editor Runtime Session

**Files:**
- Create: `packages/omnicore-editor/src/panels/scene-3d-editor-runtime-session.js`
- Test: `tests/3d-editor-runtime-session.test.js`

- [x] **Step 1: Write the failing test**

Assert a session can mount the Three viewport, import a GLB asset, select/drag a model, edit material, switch animation, add Rapier debug overlays, capture WebGPU report data, and generate save/export patches.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/3d-editor-runtime-session.test.js`
Expected: fail because `scene-3d-editor-runtime-session.js` does not exist.

- [x] **Step 3: Implement session**

Create `createScene3DEditorRuntimeSession()` with `mountViewport()`, `importGLBAsset()`, `selectByPointer()`, `dragSelected()`, `editMaterial()`, `switchAnimation()`, `applyRapierDebugDraw()`, `captureWebGPUHardware()`, `createSavePatch()`, `createExportPlan()`, and `createSnapshot()`.

### Task 2: Viewport Render State Integration

**Files:**
- Modify: `packages/omnicore-editor/src/panels/scene-3d-viewport-panel.js`
- Test: `tests/3d-editor-runtime-session.test.js`

- [x] **Step 1: Extend the failing test**

Assert `createScene3DViewportRenderState()` exposes the session module name, lifecycle commands, and save/export affordances for the editor UI.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/3d-editor-runtime-session.test.js`
Expected: fail because render state does not expose session lifecycle metadata.

- [x] **Step 3: Implement render state metadata**

Add `runtimeSession` metadata next to `canvasMount.runtime` with lifecycle command IDs and UI affordances.

### Task 3: Desktop/E2E Contract Evidence

**Files:**
- Modify: `tests/e2e/electron-3d-editor-contract.spec.js`
- Test: `tests/3d-editor-runtime-session.test.js`

- [x] **Step 1: Extend the failing test**

Assert the Electron contract names the new runtime session module and covers save/export patch generation.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/3d-editor-runtime-session.test.js`
Expected: fail because the E2E contract does not mention the session.

- [x] **Step 3: Update E2E contract**

Add contract assertions for `scene-3d-editor-runtime-session`, `createSavePatch`, and `createExportPlan`.

### Task 4: Verification and Commit

**Files:**
- Modify: `docs/api/index.html`
- Modify: `docs/api/manifest.json`

- [x] **Step 1: Run focused checks**

Run `npm test -- tests/3d-editor-runtime-session.test.js tests/3d-editor-real-runtime-template.test.js tests/3d-editor-operability-loop.test.js` and `npm run lint`.

- [x] **Step 2: Run build and E2E checks**

Run `npm run build`, `npx playwright test tests/e2e/electron-3d-editor-contract.spec.js --project=chromium`, and `git diff --check`.

- [x] **Step 3: Commit and push**

Commit as `feat(editor): add 3d runtime session loop`, then push current branch.

## Self-Review

- Spec coverage: covers operational session orchestration, viewport metadata, save/export patches, Rapier/WebGPU integration, and desktop contract evidence.
- Placeholder scan: no TBD, TODO, or undefined steps remain.
- Type consistency: public names are `createScene3DEditorRuntimeSession`, `createSavePatch`, and `createExportPlan`.
