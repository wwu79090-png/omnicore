# Engine Pattern Lifecycle Component Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue learning practical lifecycle and component orchestration patterns from LÖVE, libGDX, MonoGame, Flame, and Babylon.js.

**Architecture:** Add focused pure-runtime modules for callback game loops, screen lifecycle switching, ordered game components, mounted component trees, and observable render phases. Keep each module independent, deterministic, and exported through `src/index.js`.

**Tech Stack:** JavaScript ESM, Vitest, OmniCore runtime modules.

---

### Task 1: Contract Tests

**Files:**
- Create: `tests/engine-pattern-lifecycle-component-pack.test.js`

- [x] **Step 1: Write failing tests**

The test imports `CallbackGameLoop`, `ScreenFlowController`, `GameComponentPipeline`, `ComponentTreeRuntime`, and `SceneObservableHub` from `../src/index.js`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engine-pattern-lifecycle-component-pack.test.js`
Expected: FAIL because the new exports are missing.

### Task 2: Loop and Screen Lifecycle Foundations

**Files:**
- Create: `src/core/CallbackGameLoop.js`
- Create: `src/scene/ScreenFlowController.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement LÖVE-style load/update/draw/input callback loop**
- [x] **Step 2: Implement libGDX-style Screen show/render/resize/pause/resume/hide/dispose flow**

### Task 3: Component Runtime Foundations

**Files:**
- Create: `src/core/GameComponentPipeline.js`
- Create: `src/scene/ComponentTreeRuntime.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement MonoGame-style updateable/drawable component pipeline with order and enable flags**
- [x] **Step 2: Implement Flame-style component tree lifecycle with onLoad/onMount/update/render/onRemove**

### Task 4: Observable Render Hooks

**Files:**
- Create: `src/core/SceneObservableHub.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement Babylon.js-style observables with masks, priorities, once observers, and render phases**

### Task 5: Verification

**Files:**
- All modified files

- [x] **Step 1: Run focused tests**

Run: `npm test -- tests/engine-pattern-lifecycle-component-pack.test.js`

- [x] **Step 2: Run related engine pattern pack tests**

Run: `npm test -- tests/engine-pattern-lifecycle-component-pack.test.js tests/engine-pattern-script-event-pack.test.js tests/engine-pattern-interaction-pack.test.js tests/engine-pattern-platform-pack.test.js tests/engine-pattern-production-pack.test.js tests/engine-pattern-extension-pack.test.js tests/cross-engine-foundation-pack.test.js tests/godot-style-production-foundation.test.js`

- [x] **Step 3: Run audit, lint, docs, build, and API contract**

Run: `npm run audit:api`
Run: `npm run lint`
Run: `npm run docs:generate`
Run: `npm run build`
Run: `npm test -- tests/contract/api-contract-snapshot.test.js`

- [x] **Step 4: Run full test suite**

Run: `npm test`
