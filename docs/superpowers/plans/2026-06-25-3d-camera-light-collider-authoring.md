# 3D Camera Light Collider Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 批量补齐 3D 编辑器里 Camera、Light、Shadow、Collider 的可视化编辑闭环，让这些关键 3D 作者ing数据能进 UI、保存 patch、导出计划和 runtime sync。

**Architecture:** 沿用 `editor-app.js` 里的 3D viewport authoring session 模式，新增一组 Camera/Light/Collider EditorAPI。每个 API 更新 `scene3DViewport` 后统一刷新 `scene3DRuntimeSession`、发出 `editor:scene-3d-viewport-action` 和 `editor:scene-3d-runtime-session`，避免 UI 状态和保存导出状态分裂。

**Tech Stack:** Vitest、OmniCore editor app、`createRuntimeSyncPayload()`、`createEditorState()`。

---

### Task 1: Regression Test

**Files:**
- Create: `tests/scene-3d-viewport-camera-light-collider-sync.test.js`

- [x] **Step 1: Write the failing test**

新增测试打开 3D 视口，更新 Camera、切活动 Camera、更新 Light、切 Shadow、更新模型 Collider、切 Collider overlay，断言 UI 文本、viewport、session save patch、trace 和 runtime sync payload 都同步。

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/scene-3d-viewport-camera-light-collider-sync.test.js`

Expected: FAIL because Camera/Light/Collider authoring APIs are not exposed yet.

### Task 2: Implementation

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`

- [x] **Step 1: Add EditorAPI methods**

Add `updateScene3DCamera()`, `setScene3DActiveCamera()`, `updateScene3DLight()`, `toggleScene3DLightShadow()`, `updateScene3DModelCollider()`, and `toggleScene3DColliderOverlay()` to app API and `EditorAPI`.

- [x] **Step 2: Preserve authoring data in viewport state**

Preserve camera position/target, light color/position, collider sensor/debug metadata, and overlay visibility through `createScene3DViewportState()`.

- [x] **Step 3: Update panel rows**

Show camera position/target, light position/color/shadow, and collider shape/sensor/debug data in the 3D panel rows.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/scene-3d-viewport-camera-light-collider-sync.test.js`

Expected: PASS.

### Task 3: Verification

**Files:**
- Existing editor and 3D tests.

- [x] **Step 1: Run focused editor tests**

Run: `npm test -- tests/scene-3d-viewport-camera-light-collider-sync.test.js tests/scene-3d-viewport-transform-sync.test.js tests/scene-3d-viewport-session-authoring-sync.test.js tests/desktop-3d-runtime-session-sync.test.js tests/editor-deep-toolchain.test.js`

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

Run: `git add packages/omnicore-editor/src/editor-app.js tests/scene-3d-viewport-camera-light-collider-sync.test.js docs/superpowers/plans/2026-06-25-3d-camera-light-collider-authoring.md`

Run: `git commit -m "feat(editor): sync 3d camera light collider authoring"`

- [x] **Step 2: Push**

Run: `git push origin codex/contract-benchmark-ci`
