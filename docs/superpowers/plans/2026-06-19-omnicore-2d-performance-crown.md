# OmniCore 2D Performance Crown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move OmniCore's 2D runtime toward a WebGPU-first, worker-driven, high-pressure 2D engine profile with measurable renderer, scene, logic, asset, collaboration, and CI gates.

**Architecture:** Keep public compatibility while moving the default renderer path to native WebGPU with WebGL/canvas fallback, not Pixi. Add focused pure-2D systems for zero-copy entity buffers, dual spatial indexing, sleeping physics, event microbatching, tile streaming/collision baking, compiled EventSheet predicates, asset hot push, OTA patches, editor simulation, Yjs-compatible collaboration updates, and stricter quality gates.

**Tech Stack:** JavaScript ES modules, WebGPU API surfaces, OffscreenCanvas worker bridge, SharedArrayBuffer/ArrayBuffer typed arrays, Vitest, GitHub Actions, Yjs-compatible update protocol.

---

### Task 1: Acceptance Tests

**Files:**
- Create: `tests/omnicore-2d-performance-crown.test.js`

- [ ] **Step 1: Write tests for the 15 requested capabilities**
- [ ] **Step 2: Run `npm test -- tests/omnicore-2d-performance-crown.test.js` and verify RED**

### Task 2: WebGPU Renderer Core

**Files:**
- Modify: `src/renderer/WebGPURenderer.js`
- Modify: `src/renderer/RenderWorkerBridge.js`
- Modify: `src/renderer/RendererManager.js`
- Modify: `src/core/OmniCore.js`
- Modify: `src/index.js`

- [ ] **Step 1: Add native WebGPU pipeline/shader metadata with WGSL only**
- [ ] **Step 2: Add zero-copy `SharedArrayBuffer` entity buffer mapping**
- [ ] **Step 3: Add OffscreenCanvas worker render ownership and command submission metadata**
- [ ] **Step 4: Make renderer fallback order WebGPU then WebGL/canvas, with Pixi removed from the default path**

### Task 3: Scene Pressure Systems

**Files:**
- Create: `src/core/DualSpatialIndex.js`
- Modify: `src/optimization/SleepWakeSystem.js`
- Modify: `src/core/EventBus.js`
- Create: `src/tilemap/TilemapStreamer.js`
- Modify: `src/tilemap/Tilemap.js`
- Modify: `src/tilemap/ChunkManager.js`
- Modify: `src/index.js`

- [ ] **Step 1: Add quadtree for static objects and spatial hash for dynamic objects**
- [ ] **Step 2: Add 5-second stillness physics sleep dispatch**
- [ ] **Step 3: Add EventBus single-frame 50-event flush suppression and microbatch queue**
- [ ] **Step 4: Add worker-backed tile chunk prefetch streamer**
- [ ] **Step 5: Bake static tile collision rectangles into merged polygons**

### Task 4: Logic and Asset Pipeline Speed

**Files:**
- Modify: `src/data/EventSheet.js`
- Create: `scripts/asset-watch-server.js`
- Create: `scripts/ota-patch.js`
- Modify: `package.json`

- [ ] **Step 1: Compile EventSheet JSON conditions to cached native `Function` bodies**
- [ ] **Step 2: Add source-assets watcher with 100ms debounce and WebSocket hot push metadata**
- [ ] **Step 3: Add differential OTA `.patch` generation**

### Task 5: Editor Simulation and Collaboration

**Files:**
- Modify: `packages/omnicore-editor/src/live-sync-protocol.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Create: `packages/omnicore-editor/src/collaboration.js`

- [ ] **Step 1: Enable simulation tick metadata during drag**
- [ ] **Step 2: Add Yjs-compatible scene update protocol with local/remote update application**

### Task 6: Quality Gates

**Files:**
- Modify: `.github/workflows/pr-quality.yml`
- Modify: `scripts/visual-regression.js`
- Modify: `tests/visual/golden/examples.json`

- [ ] **Step 1: Add 100% coverage gate for `src/core`, `src/renderer`, and `src/store`**
- [ ] **Step 2: Require 10 golden scenes and 0.1% pixel threshold**
- [ ] **Step 3: Re-run targeted tests and full `npm test`**

