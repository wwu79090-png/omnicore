# OmniCore Engine Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five engine-parity capabilities: editor-to-script navigation, build-time static batching, offscreen logic warnings, event recursion protection, and mobile power-aware quality scaling.

**Architecture:** Keep each capability in the existing subsystem that already owns the behavior. The editor app emits a code-open command, rendering gets a reusable static batch manifest builder plus npm prebuild hook, culling reports stale offscreen updates, EventBus enforces recursion depth/cycle diagnostics, and AdaptiveQualityManager applies low-power profiles to renderer/loop/texture policy.

**Tech Stack:** JavaScript ESM, Vitest, Vite npm scripts, jsdom editor tests.

---

### Task 1: Editor Script Navigation

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/godot-style-editor-linking.test.js`

- [x] Add a failing test that selects an entity with `script.path` and `script.entry`, clicks an inspector code button, and asserts an `editor:open-code` transport payload containing path, symbol, line, and column.
- [x] Implement `resolveScriptBinding()` and `openEntityScript()` in the editor app.
- [x] Render an inspector button only for selected entities with script binding.
- [x] Expose `EditorAPI.openEntityScript()` for command palette and tests.
- [x] Run `npm test -- tests/godot-style-editor-linking.test.js`.

### Task 2: Build-Time Static Batching

**Files:**
- Create: `src/renderer/StaticBatchCompiler.js`
- Create: `scripts/build-static-batches.js`
- Modify: `src/index.js`
- Modify: `package.json`
- Test: `tests/render-chunk-physics-optimization.test.js`

- [x] Add a failing test that compiles repeated static sprites into one immutable batch manifest with vertex data and draw-call estimates.
- [x] Implement `StaticBatchCompiler.compileScene()` grouping static sprites by texture/render state.
- [x] Add CLI script that scans scene JSON files and writes `static-batches.json`.
- [x] Add the script to `prebuild` before Vite build.
- [x] Export `StaticBatchCompiler` from `src/index.js`.
- [x] Run `npm test -- tests/render-chunk-physics-optimization.test.js`.

### Task 3: Offscreen Logic Warning

**Files:**
- Modify: `src/optimization/ViewportCulling.js`
- Modify: `src/scene/Scene.js`
- Test: `tests/performance-systems.test.js`

- [x] Add a failing test where an offscreen entity marked `alwaysUpdate` emits one warning after enough hidden frames.
- [x] Implement `ViewportCulling.trackLogicActivity()` with threshold, cooldown, and warning callback.
- [x] Call the tracker from `Scene.update()` before entity update.
- [x] Run `npm test -- tests/performance-systems.test.js`.

### Task 4: Event Recursion Guard

**Files:**
- Modify: `src/core/EventBus.js`
- Test: `tests/runtime-hardening.test.js`

- [x] Add failing tests for depth overflow and event cycle diagnostics.
- [x] Implement `maxRecursionDepth`, stack tracking, cycle path formatting, and structured error details.
- [x] Ensure `emit()` unwinds stack state even when handlers throw.
- [x] Run `npm test -- tests/runtime-hardening.test.js`.

### Task 5: Mobile Power/Thermal Degrade

**Files:**
- Modify: `src/optimization/AdaptiveQualityManager.js`
- Modify: `src/index.js`
- Test: `tests/intelligent-runtime-systems.test.js`

- [x] Add a failing test for low-power profile applying loop FPS reduction, texture scale, and store telemetry.
- [x] Implement `AdaptiveQualityManager.applyPowerState()` and constructor loop/store options.
- [x] Wire optional `powerMode` config in `Game._runAdaptiveQuality()`.
- [x] Run `npm test -- tests/intelligent-runtime-systems.test.js`.

### Final Verification

- [x] Run targeted tests for all touched suites.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
