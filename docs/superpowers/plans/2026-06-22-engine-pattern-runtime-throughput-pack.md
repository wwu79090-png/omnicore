# Engine Pattern Runtime Throughput Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize runtime throughput by adding production-style asset residency, texture streaming budgets, job dependency scheduling, low-level server handles, and frame pacing controls.

**Architecture:** Add five focused pure-runtime modules inspired by Unity Addressables memory management and Job System, Unreal Texture Streaming, and Godot Server/RID optimization patterns. Each module remains independent, deterministic, and exported through `src/index.js`.

**Tech Stack:** JavaScript ESM, Vitest, OmniCore runtime modules.

---

### Task 1: Contract Tests

**Files:**
- Create: `tests/engine-pattern-runtime-throughput-pack.test.js`

- [ ] **Step 1: Write failing tests**

The test imports `AssetResidencyManager`, `TextureStreamingBudget`, `JobDependencyGraph`, `ServerHandleRegistry`, and `FramePacingController` from `../src/index.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engine-pattern-runtime-throughput-pack.test.js`
Expected: FAIL because the new exports are missing.

### Task 2: Memory Residency Foundations

**Files:**
- Create: `src/assets/AssetResidencyManager.js`
- Create: `src/renderer/TextureStreamingBudget.js`
- Modify: `src/index.js`

- [ ] **Step 1: Implement Unity Addressables-style reference counts, dependencies, pinning, and unload plans**
- [ ] **Step 2: Implement Unreal-style texture streaming mip choice and pool-budget downgrade plan**

### Task 3: CPU Throughput Foundations

**Files:**
- Create: `src/core/JobDependencyGraph.js`
- Create: `src/core/ServerHandleRegistry.js`
- Modify: `src/index.js`

- [ ] **Step 1: Implement Unity Job System-style dependency graph scheduling into parallel batches**
- [ ] **Step 2: Implement Godot Server/RID-style low-level handle registry with batched command flush**

### Task 4: Frame Pacing Foundations

**Files:**
- Create: `src/performance/FramePacingController.js`
- Modify: `src/index.js`

- [ ] **Step 1: Implement frame pacing histogram, hitch detection, and deterministic mitigation suggestions**

### Task 5: Verification

**Files:**
- All modified files

- [ ] **Step 1: Run focused tests**

Run: `npm test -- tests/engine-pattern-runtime-throughput-pack.test.js`

- [ ] **Step 2: Run related engine pattern pack tests**

Run: `npm test -- tests/engine-pattern-runtime-throughput-pack.test.js tests/engine-pattern-scalability-optimization-pack.test.js tests/engine-pattern-lifecycle-component-pack.test.js tests/engine-pattern-script-event-pack.test.js tests/engine-pattern-interaction-pack.test.js tests/engine-pattern-platform-pack.test.js tests/engine-pattern-production-pack.test.js tests/engine-pattern-extension-pack.test.js tests/cross-engine-foundation-pack.test.js tests/godot-style-production-foundation.test.js`

- [ ] **Step 3: Run audit, lint, docs, build, and API contract**

Run: `npm run audit:api`
Run: `npm run lint`
Run: `npm run docs:generate`
Run: `npm run build`
Run: `npm test -- tests/contract/api-contract-snapshot.test.js`

- [ ] **Step 4: Run full test suite**

Run: `npm test`
