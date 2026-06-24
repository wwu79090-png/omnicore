# 3D Model Transform Session Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 3D 编辑器里的模型拖拽、移动、旋转、缩放、重置 Transform 操作进入视口、面板、保存 patch、导出计划和 runtime sync，补齐真实编辑器最基本的 Transform 闭环。

**Architecture:** 在现有 `openScene3DViewport()`、`selectScene3DModel()`、`previewScene3DAnimation()`、`updateScene3DMaterial()` 同一层新增 Transform 编辑 API。所有 Transform API 都复用 `createScene3DViewportAuthoringSessionState()` 刷新 `scene3DRuntimeSession`，并通过 `editor:scene-3d-viewport-action` 与 `editor:scene-3d-runtime-session` 向 live sync 发送状态。

**Tech Stack:** Vitest、OmniCore editor app、`createRuntimeSyncPayload()`、`createEditorState()`。

---

### Task 1: Regression Test

**Files:**
- Create: `tests/scene-3d-viewport-transform-sync.test.js`

- [x] **Step 1: Write the failing test**

新增测试打开 3D 视口，调用 `dragScene3DModel()`、`moveScene3DModel()`、`rotateScene3DModel()`、`scaleScene3DModel()`、`resetScene3DModelTransform()`，断言模型 Transform、面板文字、session save patch、trace 与 runtime sync payload 都更新。

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/scene-3d-viewport-transform-sync.test.js`

Expected: FAIL because EditorAPI does not expose complete model transform authoring methods yet.

### Task 2: Implementation

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`

- [x] **Step 1: Add EditorAPI methods**

Add `dragScene3DModel(modelId, delta)`, `moveScene3DModel(modelId, position)`, `rotateScene3DModel(modelId, rotation)`, `scaleScene3DModel(modelId, scale)`, `updateScene3DModelTransform(modelId, transform)`, and `resetScene3DModelTransform(modelId)` to both the app API surface and `EditorAPI`.

- [x] **Step 2: Update viewport/session state**

Each method updates the matching viewport model transform, preserves selection, refreshes `scene3DRuntimeSession`, emits viewport/session events, and re-renders.

- [x] **Step 3: Show transform in the panel**

Render model position, rotation, and scale in `[data-scene-3d-model]` rows so users can see the transform result without inspecting JSON.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/scene-3d-viewport-transform-sync.test.js`

Expected: PASS.

### Task 3: Verification

**Files:**
- Existing editor and 3D tests.

- [x] **Step 1: Run focused editor tests**

Run: `npm test -- tests/scene-3d-viewport-transform-sync.test.js tests/scene-3d-viewport-session-authoring-sync.test.js tests/desktop-3d-runtime-session-sync.test.js tests/editor-deep-toolchain.test.js`

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

Run: `git add packages/omnicore-editor/src/editor-app.js tests/scene-3d-viewport-transform-sync.test.js docs/superpowers/plans/2026-06-25-3d-model-transform-session-sync.md`

Run: `git commit -m "feat(editor): sync 3d model transforms"`

- [x] **Step 2: Push**

Run: `git push origin codex/contract-benchmark-ci`
