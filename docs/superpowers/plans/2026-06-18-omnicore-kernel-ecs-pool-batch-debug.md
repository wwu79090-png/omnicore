# OmniCore Kernel ECS Pool Batch Debug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pure-kernel ECS storage, fixed-size object pools, Pixi command buffering, and debug-only render primitives.

**Architecture:** Keep PixiJS as the renderer backend, but move hot-path data into contiguous typed arrays and submit sprite draw requests through an OmniCore command buffer. Debug primitives live in a separate overlay path gated by runtime/build debug flags so release mode can omit all debug drawing work.

**Tech Stack:** JavaScript ES modules, PixiJS v8, Vitest, Vite build-time constants.

---

### Task 1: ECS Core

**Files:**
- Create: `src/core/ECS/ComponentStorage.js`
- Create: `src/core/ECS/World.js`
- Create: `src/core/ECS/Systems.js`
- Create: `src/core/ECS/index.js`
- Test: `tests/kernel-optimization.test.js`

- [ ] Write tests proving component data is pure, stored in typed arrays, and iterated by logic-only systems.
- [ ] Implement fixed-capacity entity IDs, component registration, contiguous typed-array component stores, queries, and system scheduling.
- [ ] Add a particle benchmark helper that updates 5000 position/velocity pairs without per-frame allocation.

### Task 2: Memory Pool

**Files:**
- Create: `src/core/MemoryPool.js`
- Modify: `src/index.js`
- Modify: `src/renderer/PixiRenderer.js`
- Test: `tests/kernel-optimization.test.js`

- [ ] Write tests for preallocation, allocate/free reuse, capacity exhaustion, texture reference reset, and transform reset.
- [ ] Implement `OmniCore.Pool.create(name, preAllocCount, factory, reset)` with a no-growth runtime policy.
- [ ] Use the pool registry from renderer display-object creation when configured.

### Task 3: Pixi Batch Adapter

**Files:**
- Create: `src/renderer/PixiBatchAdapter.js`
- Modify: `src/renderer/PixiRenderer.js`
- Test: `tests/kernel-optimization.test.js`

- [ ] Write tests for draw-call command shape, texture-primary and zIndex-secondary sorting, stable ordering, and single flush into Pixi.
- [ ] Implement reusable command storage and frame reset without reallocating the command array.
- [ ] Let `PixiRenderer` opt into command-buffer scene sync while keeping Canvas fallback unchanged.

### Task 4: Debug Renderer

**Files:**
- Create: `src/debug/DebugRenderer.js`
- Modify: `src/index.js`
- Modify: `src/core/OmniCore.js`
- Test: `tests/kernel-optimization.test.js`

- [ ] Write tests for disabled no-op behavior, enabled line/circle/AABB recording, overlay-only flush, and release-mode module stripping flag.
- [ ] Implement `OmniCore.Debug.drawLine`, `drawCircle`, and `drawAABB`.
- [ ] Attach debug overlay after normal scene rendering and never feed debug commands into ECS, collision, or zIndex paths.

### Verification

- [ ] Run `npm test -- tests/kernel-optimization.test.js`.
- [ ] Run focused existing renderer and performance tests.
- [ ] Run `npm run build`.
- [ ] Record benchmark evidence in `BENCHMARK_RESULT.md` or a release note if synthetic thresholds pass locally.
