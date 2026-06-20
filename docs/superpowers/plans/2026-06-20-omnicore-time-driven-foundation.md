# OmniCore Time Driven Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic fixed timestep, explicit scene update/render lifecycle, pre-update input refresh, Store commit isolation, per-scene timers, Dimension3D delta binding, and a browser migration demo.

**Architecture:** Keep `Loop.subscribe()` as the existing fixed-update channel and add a separate render channel so rendering happens once per animation frame with interpolation. Move scene runtime behavior behind explicit `enter/update/render/exit` methods while preserving `init/preload/create/update/destroy`. Store commit isolation is transaction-scoped during scene logic so legacy direct `store.set()` behavior remains compatible outside a frame.

**Tech Stack:** JavaScript ESM, Vitest, existing OmniCore Loop/SceneManager/Store/Timer/Dimension3D modules, static HTML demo.

---

### Task 1: Time Foundation Regression Tests

**Files:**
- Create: `tests/time-driven-foundation.test.js`

- [x] **Step 1: Write failing fixed timestep and render interpolation tests**

Test `Loop` with manual `_tick()` calls: a 16.666ms step produces one fixed update and one render; a 33.333ms step produces two fixed updates and one render; both use the same fixed update delta.

- [x] **Step 2: Write failing Scene lifecycle, input, Store, timer, and Dimension3D tests**

Cover `onEnter`, `onUpdate`, `onRender`, `onExit`, input refresh before update, `Store.beginFrame()/commit()`, scene-local `timer.delay()/interval()`, and `Dimension3D.bindGameTime()`.

- [x] **Step 3: Run RED**

Run: `npm test -- tests/time-driven-foundation.test.js --reporter=dot`

Expected: FAIL because render subscribers, Store frame commits, explicit lifecycle hooks, and game-time binding are incomplete.

### Task 2: Runtime Implementation

**Files:**
- Modify: `src/loop/Loop.js`
- Modify: `src/scene/Scene.js`
- Modify: `src/scene/SceneManager.js`
- Modify: `src/input/InputManager.js`
- Modify: `src/store/Store.js`
- Modify: `src/core/OmniCore.js`
- Modify: `src/dimension3d/Dimension3D.js`

- [x] **Step 1: Implement Loop fixed update/render channels**

Keep fixed-update subscribers under `subscribe()`, add `subscribeRender()`, update `loop.time`, and call render subscribers once after all fixed updates.

- [x] **Step 2: Implement Scene lifecycle and per-scene timer**

Add `enter`, `render`, and `exit` methods; call `onUpdate` from `update`; advance scene timer inside `Scene.update`.

- [x] **Step 3: Implement Store frame transactions**

Add `beginFrame`, `commit`, `rollback`, and staged write storage. During a frame, `setValue` stages writes and `commit` publishes them before render.

- [x] **Step 4: Wire SceneManager order**

Update phase: input refresh, camera update, Store frame begin, scene update, Store commit. Render phase: scene render hook, renderer renderScene, profiler/performance updates.

- [x] **Step 5: Bind Dimension3D to game time**

Add `bindGameTime` and use bound `game.time.delta` when render is called without an explicit delta.

### Task 3: Demo and Verification

**Files:**
- Create: `examples/migration-demo.html`
- Modify tests as needed for updated lifecycle expectations.

- [x] **Step 1: Create migration demo HTML**

Demo should show fixed updates, render interpolation alpha, input refresh, Store commit, scene timers, and Dimension3D delta binding with visible counters.

- [x] **Step 2: Run focused tests**

Run: `npm test -- tests/time-driven-foundation.test.js tests/omnicore.test.js tests/dimension3d-game-loop.test.js --reporter=dot`

- [x] **Step 3: Run quality checks**

Run: `npm run lint`, `npm run test:contract`, and `npm test -- --reporter=dot`.

- [x] **Step 4: Build**

Run: `npm run build -- --check-3d`.
