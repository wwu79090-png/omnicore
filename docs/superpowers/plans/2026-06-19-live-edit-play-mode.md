# Live Edit Play Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first OmniCore Live Edit and Play Mode vertical slice: pause live simulation, edit the runtime world, render immediately, resume from the edited state, and inspect per-frame subsystem timings.

**Architecture:** Add a runtime `PlaySession` command router plus `FrameProfiler`, then connect them through `RuntimeLiveSyncBridge`, `SceneManager`, `OmniCore`, Live Sync protocol state, and the desktop editor toolbar/panels. Keep the feature opt-in and backward compatible with the current editor and runtime APIs.

**Tech Stack:** JavaScript ESM, Vitest, jsdom editor tests, existing OmniCore runtime/editor packages.

---

### Task 1: Runtime Play Session and Commands

**Files:**
- Create: `src/editor/PlaySession.js`
- Modify: `src/editor/RuntimeLiveSyncBridge.js`
- Modify: `src/scene/SceneManager.js`
- Test: `tests/live-edit-play-mode.test.js`

- [ ] **Step 1: Write failing runtime tests**

Add tests that construct a fake game with a scene child update spy, renderer spy, store spy, database, and events. Assert that `PlaySession` starts in `editing`, can switch to `playing` and `paused`, skips scene child updates while paused through `SceneManager.update()`, applies `editor:update-entity` while paused, preserves custom `hp`, and rejects invalid modes with `runtime:command-error`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/live-edit-play-mode.test.js`

Expected: FAIL because `src/editor/PlaySession.js` does not exist and `SceneManager` has no play-session gate.

- [ ] **Step 3: Implement minimal runtime**

Create `PlaySession` with `snapshot()`, `setMode(mode)`, `shouldAdvanceSimulation()`, `applyEditorMessage(message)`, `applyCommand(type, payload)`, `applyEntityPatch()`, `createEntity()`, `updateDatabaseRecord()`, `updateTilemap()`, `requestRender()`, `publishState()`, and duplicate `commandId` protection. Update `RuntimeLiveSyncBridge` to own/use a play session and route editor messages through it. Update `SceneManager.update()` to skip current scene update when `game.playSession.shouldAdvanceSimulation()` is false while still rendering and updating performance stats.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/live-edit-play-mode.test.js`

Expected: PASS with no console errors or warnings.

### Task 2: Live Sync Protocol State

**Files:**
- Modify: `packages/omnicore-editor/src/live-sync-protocol.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/live-edit-play-mode.test.js`
- Test: `tests/industrialization-decoupled.test.js`

- [ ] **Step 1: Write failing protocol/editor tests**

Add tests that `runtime:play-state` updates editor state, `runtime:profiler-frame` stores the latest frame, custom entity fields such as `hp` survive `serializeSceneForSync()` and `applyLiveSyncMessage()`, and toolbar Play/Pause sends `editor:set-play-mode` instead of local-only `editor:play`/`editor:pause`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/live-edit-play-mode.test.js tests/industrialization-decoupled.test.js`

Expected: FAIL because the protocol does not normalize play state/profiler frame and toolbar emits legacy action messages.

- [ ] **Step 3: Implement protocol/editor state**

Add `playState`, `profilerFrame`, and `database` fields to `createEditorState()`. Handle `runtime:play-state`, `runtime:profiler-frame`, `runtime:database`, and `runtime:command-error`. Preserve unknown entity fields in protocol scene serialization. Add a `profiler` panel to editor layout. Change toolbar Play/Pause to emit `editor:set-play-mode` with `playing` and `paused`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/live-edit-play-mode.test.js tests/industrialization-decoupled.test.js`

Expected: PASS with no console errors or warnings.

### Task 3: Frame Profiler and Debug Waterfall

**Files:**
- Create: `src/debug/FrameProfiler.js`
- Create: `src/debug/ProfilerWaterfallPanel.js`
- Modify: `src/core/OmniCore.js`
- Modify: `src/scene/SceneManager.js`
- Modify: `src/index.js`
- Test: `tests/live-edit-play-mode.test.js`

- [ ] **Step 1: Write failing profiler tests**

Add tests that `FrameProfiler` records named sections, exports latest frame totals, keeps a bounded history, and `ProfilerWaterfallPanel` renders bars without throwing in jsdom.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/live-edit-play-mode.test.js`

Expected: FAIL because profiler modules are missing.

- [ ] **Step 3: Implement profiler**

Create `FrameProfiler` with `startFrame()`, `measure(name, fn)`, `record(name, duration, meta)`, `endFrame()`, `latest()`, `export()`, and `clear()`. Create `ProfilerWaterfallPanel` with `attach()`, `refresh(frame)`, and `detach()`. Instantiate them in `OmniCore` when `debug` or `editorLiveEdit` is enabled. Wrap input, camera, scene, render, and performance monitor sections in `SceneManager.update()`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/live-edit-play-mode.test.js`

Expected: PASS with no console errors or warnings.

### Task 4: Regression Verification

**Files:**
- Test: `tests/live-edit-play-mode.test.js`
- Test: `tests/industrialization-decoupled.test.js`
- Test: `tests/industrialization-complete.test.js`
- Test: `tests/editor-maturity-ui.test.js`
- Test: `tests/omnicore-2d-performance-crown.test.js`

- [ ] **Step 1: Run focused regression suite**

Run: `npm test -- tests/live-edit-play-mode.test.js tests/industrialization-decoupled.test.js tests/industrialization-complete.test.js tests/editor-maturity-ui.test.js tests/omnicore-2d-performance-crown.test.js`

Expected: PASS with no errors or warnings.

- [ ] **Step 2: Inspect git diff**

Run: `git diff -- src packages tests docs/superpowers/plans/2026-06-19-live-edit-play-mode.md`

Expected: Only Live Edit Play Mode files and the plan changed.
