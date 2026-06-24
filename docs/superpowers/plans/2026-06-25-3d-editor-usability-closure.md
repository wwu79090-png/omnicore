# 3D Editor Usability Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 批量补齐 3D Inspector/Gizmo、Undo/Redo、场景层级、GLTF 导入增强、Rapier 编辑、动画编辑、EXE E2E 合约这一整组编辑器实用闭环。

**Architecture:** 沿用 `editor-app.js` 的 3D viewport authoring session 管线，把新增能力挂在 `scene3DViewport` 的结构化子状态上，再由 `createScene3DViewportAuthoringSessionState()` 写入 save patch/runtime sync。新增 EditorAPI 方法保持薄入口，所有状态更新统一走 `applyScene3DViewportAuthoringAction()`，避免 UI、session、导出数据分裂。

**Tech Stack:** Vitest、OmniCore editor app、`createRuntimeSyncPayload()`、Electron 3D E2E contract。

---

### Task 1: Regression Test

**Files:**
- Create: `tests/scene-3d-editor-usability-closure.test.js`

- [x] **Step 1: Write the failing test**

新增一个整包测试，覆盖 Inspector/Gizmo、Undo/Redo、层级节点、GLTF 导入增强、Rapier 配置、动画配置、EXE E2E contract。

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/scene-3d-editor-usability-closure.test.js`

Expected: FAIL because these EditorAPI usability closure methods are not exposed yet.

### Task 2: Implementation

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `tests/e2e/electron-3d-editor-contract.spec.js`

- [x] **Step 1: Add EditorAPI methods**

Add focused 3D usability methods for inspector/gizmo, undo/redo, hierarchy, GLTF import, Rapier editing, animation editing, and EXE E2E plan.

- [x] **Step 2: Persist into viewport/session**

Persist new sub-states into `scene3DViewport` and `scene3DRuntimeSession.savePatch.runtime`.

- [x] **Step 3: Render authoring summaries**

Render visible rows in the 3D viewport panel for inspector/gizmo, hierarchy, import, Rapier, animation, and E2E plan.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/scene-3d-editor-usability-closure.test.js`

Expected: PASS.

### Task 3: Verification

**Files:**
- Existing editor and 3D tests.

- [x] **Step 1: Run focused editor tests**

Run: `npm test -- tests/scene-3d-editor-usability-closure.test.js tests/scene-3d-viewport-camera-light-collider-sync.test.js tests/scene-3d-viewport-transform-sync.test.js tests/scene-3d-viewport-session-authoring-sync.test.js tests/desktop-3d-runtime-session-sync.test.js tests/editor-deep-toolchain.test.js`

- [x] **Step 2: Run quality gates**

Run: `npm run lint`

Run: `npm --workspace packages/omnicore-editor run build`

Run: `npm run build`

Run: `npx playwright test tests/e2e/electron-3d-editor-contract.spec.js --project=chromium`

Run: `git diff --check`

### Task 4: Commit And Push

**Files:**
- All changed files from this plan.

- [x] **Step 1: Commit**

Run: `git add packages/omnicore-editor/src/editor-app.js tests/scene-3d-editor-usability-closure.test.js tests/e2e/electron-3d-editor-contract.spec.js docs/superpowers/plans/2026-06-25-3d-editor-usability-closure.md`

Run: `git commit -m "feat(editor): close 3d usability authoring loop"`

- [x] **Step 2: Push**

Run: `git push origin codex/contract-benchmark-ci`
