# OmniCore Extreme Quality And Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Force-upgrade OmniCore startup latency, GC resilience, UI repaint cost, logic-thread isolation, and core hot replacement with measurable runtime interfaces.

**Architecture:** Keep the changes incremental and testable. Startup first-frame work lives in `vite.config.js` and `examples/index.html`; GC and callback reuse are runtime safeguards in `Loop` and `EventBus`; UI dirty rendering is a new manager under `src/ui`; logic isolation is a new `LogicWorker` facade built on `WorkerManager`; core hot replacement extends `HotReload` without forcing page reloads.

**Tech Stack:** JavaScript ESM, Vite plugin hooks, Vitest/jsdom, Canvas/OffscreenCanvas-compatible APIs, SharedArrayBuffer-backed worker channels.

---

### Task 1: First-Frame Startup Path

**Files:**
- Modify: `vite.config.js`
- Modify: `examples/index.html`
- Test: `tests/extreme-quality-performance.test.js`

- [ ] Write a test asserting the example page has inline critical CSS, inline SVG skeleton, and a precompile script before the module entry.
- [ ] Add a Vite closeBundle plugin that emits `dist/omnicore-first-frame-bootstrap.js`.
- [ ] Add inline skeleton and precompile script in `examples/index.html`.

### Task 2: MemoryGuardian And Zero-GC Event Protocol

**Files:**
- Create: `src/debug/MemoryGuardian.js`
- Modify: `src/loop/Loop.js`
- Modify: `src/core/EventBus.js`
- Modify: `src/index.js`
- Test: `tests/extreme-quality-performance.test.js`

- [ ] Write tests for minor GC diagnostics and loop frame reporting.
- [ ] Write tests rejecting anonymous EventBus callbacks in debug mode.
- [ ] Implement `MemoryGuardian` and wire it into `Loop`.
- [ ] Add EventBus debug handler reuse validation.

### Task 3: Dirty Rect UI Rendering

**Files:**
- Create: `src/ui/UIRenderManager.js`
- Modify: `src/ui/UIElement.js`
- Modify: `src/ui/Button.js`
- Modify: `src/index.js`
- Test: `tests/extreme-quality-performance.test.js`

- [ ] Write tests showing only dirty rectangles are cleared and static panels use offscreen cache.
- [ ] Implement `UIRenderManager`.
- [ ] Add `markDirty`, `setBounds`, and `setVisible` helpers to UI elements.
- [ ] Add hover state mutation to `Button`.

### Task 4: LogicWorker Shared Render Channel

**Files:**
- Create: `src/worker/LogicWorker.js`
- Modify: `src/index.js`
- Test: `tests/extreme-quality-performance.test.js`

- [ ] Write tests proving logic frames run through `WorkerManager.run` and render values are written into a shared channel.
- [ ] Implement a serializable logic frame task and shared render-state layout.
- [ ] Expose `LogicWorker` from the public package entry.

### Task 5: Core HMR Without Reload

**Files:**
- Modify: `src/hotreload/HotReload.js`
- Test: `tests/extreme-quality-performance.test.js`

- [ ] Write tests for `type: "core-module"` hot reload using dynamic import and loop resume on the next frame.
- [ ] Implement `_applyCoreModule` with cache-busted import, `window.OmniCore` replacement, and no `window.location.reload()`.

### Task 6: Verification

- [ ] Run `npm test -- tests/extreme-quality-performance.test.js`.
- [ ] Run related existing tests for `Loop`, `EventBus`, `WorkerManager`, `HotReload`, and UI if present.
- [ ] Run `npx eslint` on modified files.
- [ ] Run `git diff --check`.
