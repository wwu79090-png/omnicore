# Desktop 3D Session Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the 3D runtime session into the desktop launcher/editor state so launcher actions produce save/export-ready 3D session data.

**Architecture:** Keep the runtime session module separate and call it from `editor-app.js` through small desktop adapters. Avoid importing the full OmniCore root bundle back into the editor.

**Tech Stack:** JavaScript ESM, Vitest/jsdom, OmniCore editor desktop launcher, existing `createScene3DEditorRuntimeSession`.

---

### Task 1: Desktop Session Red Test

**Files:**
- Create: `tests/desktop-3d-runtime-session-integration.test.js`

- [x] **Step 1: Write the failing test**

Assert desktop `scene-3d-demo` execution creates `scene3DRuntimeSession` with snapshot, save patch, export plan, and trace. Assert desktop `gltf-import` execution adds an imported GLB model/resource into the same session.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/desktop-3d-runtime-session-integration.test.js`
Expected: fail because `editor-app.js` does not write `scene3DRuntimeSession`.

### Task 2: Editor App Integration

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`

- [x] **Step 1: Import session module**

Import `createScene3DEditorRuntimeSession` from the local panel module.

- [x] **Step 2: Add desktop adapters**

Add lightweight desktop adapters for GLB import, Rapier overlay, and WebGPU status that produce deterministic editor-state data without GPU or file-system requirements.

- [x] **Step 3: Wire launcher commands**

Update `scene-3d-demo` and `gltf-import` command execution to update `current.scene3DRuntimeSession`.

### Task 3: Verification and Commit

**Files:**
- Modify: `docs/superpowers/plans/2026-06-25-desktop-3d-session-integration.md`

- [x] **Step 1: Run focused checks**

Run `npm test -- tests/desktop-3d-runtime-session-integration.test.js tests/3d-editor-runtime-session.test.js tests/3d-editor-operability-loop.test.js tests/desktop-editor-packaging.test.js` and `npm run lint`.

- [x] **Step 2: Run build and diff checks**

Run `npm --workspace packages/omnicore-editor run build`, `npm run build`, and `git diff --check`.

- [x] **Step 3: Commit and push**

Commit as `feat(editor): wire desktop 3d runtime session`, then push current branch.

## Self-Review

- Spec coverage: connects previously isolated session capability into actual desktop launcher actions.
- Placeholder scan: no TBD or undefined steps remain.
- Type consistency: state key is `scene3DRuntimeSession`.
