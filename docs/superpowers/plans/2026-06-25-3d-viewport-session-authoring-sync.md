# 3D Viewport Session Authoring Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 3D 编辑器视口里的模型选择、动画预览和材质调参同步进入 `scene3DRuntimeSession`，使保存 patch、导出计划和 runtime sync payload 反映用户真实编辑结果。

**Architecture:** 保持 `editor-app.js` 的现有 EditorAPI 入口不变，新增一个聚焦 helper 从 `scene3DViewport` 生成/刷新 runtime session 快照。每个 3D 编辑动作更新 viewport 后立即刷新 session，并追加 action trace；桌面 Demo 的完整 session 仍沿用现有 `createScene3DEditorRuntimeSession` 路径。

**Tech Stack:** Vitest、OmniCore editor app、`createRuntimeSyncPayload()`、`createEditorState()`。

---

### Task 1: Regression Test

**Files:**
- Create: `tests/scene-3d-viewport-session-authoring-sync.test.js`

- [x] **Step 1: Write the failing test**

新增测试打开 3D 视口，执行 `selectScene3DModel()`、`previewScene3DAnimation()`、`updateScene3DMaterial()`，然后断言 `scene3DRuntimeSession.savePatch.runtime`、trace 和 `createRuntimeSyncPayload()` 都包含更新后的模型、动画和材质。

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/scene-3d-viewport-session-authoring-sync.test.js`

Expected: FAIL because viewport actions currently update `scene3DViewport` only, not `scene3DRuntimeSession`.

### Task 2: Minimal Implementation

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`

- [x] **Step 1: Add a session snapshot helper**

Create `createScene3DViewportAuthoringSessionState(viewport, previousSession, action)` near the existing 3D helpers. It returns `omnicore.editor-scene-3d-runtime-session.v1` with scene data, summary, save patch, export plan, and appended trace.

- [x] **Step 2: Wire EditorAPI actions**

Call the helper from `openScene3DViewport()`, `selectScene3DModel()`, `previewScene3DAnimation()`, and `updateScene3DMaterial()` after each viewport update.

- [x] **Step 3: Run test to verify it passes**

Run: `npm test -- tests/scene-3d-viewport-session-authoring-sync.test.js`

Expected: PASS.

### Task 3: Verification

**Files:**
- Existing editor and 3D tests.

- [x] **Step 1: Run focused editor tests**

Run: `npm test -- tests/scene-3d-viewport-session-authoring-sync.test.js tests/desktop-3d-runtime-session-sync.test.js tests/desktop-3d-runtime-session-integration.test.js tests/editor-deep-toolchain.test.js`

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

Run: `git add packages/omnicore-editor/src/editor-app.js tests/scene-3d-viewport-session-authoring-sync.test.js docs/superpowers/plans/2026-06-25-3d-viewport-session-authoring-sync.md`

Run: `git commit -m "feat(editor): sync 3d viewport authoring session"`

- [x] **Step 2: Push**

Run: `git push origin codex/contract-benchmark-ci`
