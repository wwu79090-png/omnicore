# OmniCore Performance Hot Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing runtime performance hot-path governance APIs for batching, pooling, dirty sync, assets, workers, texture budgets, tile streaming, animation LOD, and WebGPU batch descriptors.

**Architecture:** Keep changes additive and compatible with the current OmniCore module layout. Implement small pure helpers where possible, wire them through `src/index.js`, and prove each behavior with one focused Vitest suite.

**Tech Stack:** JavaScript ESM, Vitest, existing OmniCore runtime modules, no new dependencies.

---

### Task 1: Red Test For Performance Hot Paths

**Files:**
- Create: `tests/performance-hot-paths-suite.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import OmniCore from '../src/index.js';

describe('performance hot path governance suite', () => {
  it('exports all hot-path helpers on OmniCore', () => {
    expect(OmniCore.optimizeRenderQueueForBatching).toBeDefined();
    expect(OmniCore.createRuntimeObjectPools).toBeDefined();
    expect(OmniCore.DirtyFlagTracker).toBeDefined();
    expect(OmniCore.createAsyncAssetPipeline).toBeDefined();
    expect(OmniCore.createIncrementalSpatialIndexReport).toBeDefined();
    expect(OmniCore.WorkerTaskScheduler).toBeDefined();
    expect(OmniCore.createTextureBudgetPlan).toBeDefined();
    expect(OmniCore.createTilemapChunkStreamPlan).toBeDefined();
    expect(OmniCore.createAnimationLODPlan).toBeDefined();
    expect(OmniCore.createWebGPUInstancingDescriptor).toBeDefined();
    expect(OmniCore.createWebGPUTextureArrayBatch).toBeDefined();
    expect(OmniCore.createWebGPUComputeDispatchPlan).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/performance-hot-paths-suite.test.js --reporter=default`

Expected: FAIL because the public helpers are not exported yet.

### Task 2: Implement Runtime Hot-Path Modules

**Files:**
- Create: `src/renderer/RenderQueueOptimizer.js`
- Create: `src/pool/RuntimeObjectPools.js`
- Create: `src/performance/DirtyFlagTracker.js`
- Create: `src/loader/AsyncAssetPipeline.js`
- Create: `src/performance/SpatialIndexOptimizer.js`
- Create: `src/worker/WorkerTaskScheduler.js`
- Create: `src/optimization/TextureBudget.js`
- Create: `src/tilemap/TilemapChunkStreaming.js`
- Create: `src/animation/AnimationLOD.js`
- Modify: `src/renderer/WebGPURenderer.js`
- Modify: `src/index.js`

- [ ] **Step 1: Add pure helper implementations**

Each helper returns serializable plans or small runtime facades so tests can run in Node and browser environments.

- [ ] **Step 2: Wire helpers through `src/index.js`**

Import each helper and expose it both as named export and on the default OmniCore namespace.

- [ ] **Step 3: Run focused test**

Run: `npx vitest run tests/performance-hot-paths-suite.test.js --reporter=default`

Expected: PASS.

### Task 3: Docs, API Snapshot, And Release Checks

**Files:**
- Create: `docs/performance-hot-paths.md`
- Modify: `package.json`
- Generated: `docs/api/*`

- [ ] **Step 1: Document the strategies**

Describe the frame-time reason for each helper and give one minimal code sample.

- [ ] **Step 2: Regenerate docs and API contract**

Run: `npm run docs:generate`

Run: `node scripts/contract/snapshot-api-contract.js --update`

- [ ] **Step 3: Run verification**

Run: `npx vitest run tests/performance-hot-paths-suite.test.js tests/performance-budget.test.js tests/benchmark-threshold.test.js tests/renderer-backends-mvp.test.js tests/contract/api-contract-snapshot.test.js --reporter=default`

Run: `npm run lint`

Run: `npm run test`

Run: `npm run build`

Run: `npm run publish:dry-run`

Expected: all commands exit with status 0 and no ignored warnings.
