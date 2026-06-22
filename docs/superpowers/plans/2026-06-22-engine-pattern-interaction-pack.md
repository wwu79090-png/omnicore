# Engine Pattern Interaction Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add another practical engine pattern pack inspired by Adventure Game Studio, GB Studio, Bitsy, Panda3D, and jMonkeyEngine.

**Architecture:** Add focused pure-data/runtime modules for point-and-click room hotspots, Bitsy-style exits/endings, GB Studio-style event command scripts, Panda3D-style task chains, and jMonkeyEngine-style application state lifecycle. Each module remains independent and is exported through `src/index.js`.

**Tech Stack:** JavaScript ESM, Vitest, OmniCore runtime modules.

---

### Task 1: Contract Tests

**Files:**
- Create: `tests/engine-pattern-interaction-pack.test.js`

- [x] **Step 1: Write failing tests**

The test imports `RoomHotspotMap`, `RoomExitGraph`, `EventCommandQueue`, `TaskChainManager`, and `ApplicationStateStack` from `../src/index.js`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engine-pattern-interaction-pack.test.js`
Expected: FAIL because the new exports are missing.

### Task 2: Room Interaction Foundations

**Files:**
- Create: `src/scene/RoomHotspotMap.js`
- Create: `src/scene/RoomExitGraph.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement AGS-style hotspot hit testing and verb interactions**
- [x] **Step 2: Implement Bitsy-style room exits, locked transitions, dialogs, and endings**

### Task 3: Event Command and Task Foundations

**Files:**
- Create: `src/data/EventCommandQueue.js`
- Create: `src/core/TaskChainManager.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement GB Studio-style command queue and reusable custom event scripts**
- [x] **Step 2: Implement Panda3D-style named tasks, delayed tasks, and task status returns**

### Task 4: Application State Foundations

**Files:**
- Create: `src/core/ApplicationStateStack.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement jMonkeyEngine-style attach/detach, enable/disable, update, and render lifecycle**

### Task 5: Verification

**Files:**
- All modified files

- [x] **Step 1: Run focused tests**

Run: `npm test -- tests/engine-pattern-interaction-pack.test.js`

- [x] **Step 2: Run all engine pattern pack tests**

Run: `npm test -- tests/engine-pattern-interaction-pack.test.js tests/engine-pattern-platform-pack.test.js tests/engine-pattern-production-pack.test.js tests/engine-pattern-extension-pack.test.js tests/cross-engine-foundation-pack.test.js tests/godot-style-production-foundation.test.js`

- [x] **Step 3: Run audit, lint, docs, build, and API contract**

Run: `npm run audit:api`
Run: `npm run lint`
Run: `npm run docs:generate`
Run: `npm run build`
Run: `npm test -- tests/contract/api-contract-snapshot.test.js`

- [x] **Step 4: Run full test suite**

Run: `npm test`
