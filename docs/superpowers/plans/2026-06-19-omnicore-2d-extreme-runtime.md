# OmniCore 2D Extreme Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the 2D extreme-runtime requirements into measurable OmniCore engine constraints: WebGPU-first rendering, worker-isolated batched frames, scalable scene logic, compiled events, binary tile collisions, dynamic physics bounds, resource HMR, collaborative editing, and entity highlight linkage.

**Architecture:** Keep all work inside the current OmniCore source tree. Extend existing modules rather than replacing them: `WebGPURenderer`, `ChunkManager`, `SleepWakeSystem`, `EventBus`, `EventSheet`, `Tilemap`, `PhysicsWorld`, asset pipeline scripts, and `omnicore-editor`.

**Tech Stack:** JavaScript ESM, Vitest, WebGPU abstraction, OffscreenCanvas worker bridge, Node build scripts, existing editor collaboration protocol.

---

### Task 1: Render-Path Constraints

**Files:**
- Modify: `src/renderer/WebGPURenderer.js`
- Modify: `src/renderer/RenderWorkerBridge.js`
- Test: `tests/omnicore-2d-extreme-runtime.test.js`

- [ ] **Step 1: Write RED test** proving 1000 sprites are grouped into at most 5 WebGPU batches, worker messages carry `pipelineOwner: "worker"`, and renderer fallback remains `webgpu -> webgl -> canvas`.
- [ ] **Step 2: Implement `buildGPUBatches()`** grouping by texture/material/blend mode and capping submitted batch instructions to 5.
- [ ] **Step 3: Include batch metadata** in worker frame messages.

### Task 2: Scene Logic Constraints

**Files:**
- Modify: `src/tilemap/ChunkManager.js`
- Modify: `src/optimization/SleepWakeSystem.js`
- Modify: `src/core/EventBus.js`
- Test: `tests/omnicore-2d-extreme-runtime.test.js`

- [ ] **Step 1: Add infinite chunk manager mode** that preloads a 3x3 window around the player and unloads chunks farther than 5 chunk cells.
- [ ] **Step 2: Add distance sleep helper** that deactivates entities farther than 50px and wakes them next frame when close.
- [ ] **Step 3: Add timestamped event queue** with overflow threshold 100 and microbatch size 10 per frame.

### Task 3: Event, Tilemap, And Physics Constraints

**Files:**
- Modify: `src/data/EventSheet.js`
- Modify: `src/tilemap/Tilemap.js`
- Modify: `src/physics/PhysicsWorld.js`
- Test: `tests/omnicore-2d-extreme-runtime.test.js`

- [ ] **Step 1: Expose condition AST metadata** when EventSheet compiles conditions to native Functions.
- [ ] **Step 2: Serialize baked tile collision polygons into a compact binary buffer.**
- [ ] **Step 3: Expand physics world bounds around the player when movement exceeds current bounds.**

### Task 4: Resource And Editor Constraints

**Files:**
- Modify: `scripts/asset-watch-server.js`
- Create: `src/assets/ResourceHMRClient.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/omnicore-2d-extreme-runtime.test.js`

- [ ] **Step 1: Add incremental build report with changed file count and sub-200ms target metadata.**
- [ ] **Step 2: Add WebSocket HMR receiver that applies pushed asset updates.**
- [ ] **Step 3: Link editor entity selection to runtime highlight messages and visible scene-node highlight state.**

### Task 5: Verification

**Files:**
- Test: full test suite
- Build: `npm run build`
- Performance: `npm run benchmark:ci`
- Visual: `npm run test:visual`

- [ ] **Step 1: Run focused tests** for the new runtime constraints.
- [ ] **Step 2: Refresh API contract if public exports change.**
- [ ] **Step 3: Run full verification commands and report exact pass/fail counts.**
