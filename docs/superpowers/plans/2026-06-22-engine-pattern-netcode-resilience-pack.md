# Engine Pattern Netcode Resilience Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen multiplayer foundations with prediction, rollback, snapshot interpolation, lag compensation, and replication interest management.

**Architecture:** Add five small ESM modules under `src/net` inspired by Unreal Replication Graph, Unity Netcode prediction/server rewind, Godot high-level multiplayer separation, and Source-style latency compensation. Each module is deterministic, pure data oriented, and exported through `src/index.js` without changing existing socket or room behavior.

**Tech Stack:** JavaScript ESM, Vitest, OmniCore runtime modules.

---

### Task 1: Contract Tests

**Files:**
- Create: `tests/engine-pattern-netcode-resilience-pack.test.js`

- [ ] **Step 1: Write failing tests**

The test imports `NetworkSnapshotBuffer`, `ClientPredictionReconciler`, `RollbackFrameStore`, `LagCompensationTimeline`, and `ReplicationInterestGraph` from `../src/index.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engine-pattern-netcode-resilience-pack.test.js`
Expected: FAIL because the new exports are missing.

### Task 2: Client Timeline Foundations

**Files:**
- Create: `src/net/NetworkSnapshotBuffer.js`
- Create: `src/net/ClientPredictionReconciler.js`
- Modify: `src/index.js`

- [ ] **Step 1: Implement snapshot buffering with interpolation, extrapolation, and pruning**
- [ ] **Step 2: Implement prediction reconciliation with authoritative correction and input replay**

### Task 3: Rollback And Rewind Foundations

**Files:**
- Create: `src/net/RollbackFrameStore.js`
- Create: `src/net/LagCompensationTimeline.js`
- Modify: `src/index.js`

- [ ] **Step 1: Implement fixed-capacity rollback frame storage and restore lookup**
- [ ] **Step 2: Implement server-side rewind lookup for historical hitbox validation**

### Task 4: Replication Interest Foundations

**Files:**
- Create: `src/net/ReplicationInterestGraph.js`
- Modify: `src/index.js`

- [ ] **Step 1: Implement grid/team/owner/always-relevant actor gathering**

### Task 5: Verification

**Files:**
- All modified files

- [ ] **Step 1: Run focused tests**

Run: `npm test -- tests/engine-pattern-netcode-resilience-pack.test.js`

- [ ] **Step 2: Run related network and engine pattern tests**

Run: `npm test -- tests/engine-pattern-netcode-resilience-pack.test.js tests/engine-pattern-extension-pack.test.js tests/foundation-closure.test.js tests/commercial-engine-mvp.test.js tests/intelligent-runtime-systems.test.js`

- [ ] **Step 3: Update API contract and docs**

Run: `node scripts/contract/snapshot-api-contract.js --update`
Run: `npm test -- tests/contract/api-contract-snapshot.test.js`
Run: `npm run docs:generate`

- [ ] **Step 4: Run audit, lint, build, and full tests**

Run: `npm run audit:api`
Run: `npm run lint`
Run: `npm run build`
Run: `npm test`
