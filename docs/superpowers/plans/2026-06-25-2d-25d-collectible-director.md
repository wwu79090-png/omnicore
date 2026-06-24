# 2D/2.5D Collectible Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-oriented 2D/2.5D collectible director for pickups, magnet attraction, drop spawning, inventory deltas, score/combo rewards, feedback, editor panels, and runtime sync.

**Architecture:** Follow the existing gameplay Director pattern. The module normalizes actor, collectible, and drop-source inputs, computes deterministic one-step outputs, and returns runtime, editor, debug, and quality metadata through one stable public contract.

**Tech Stack:** JavaScript ES modules, Vitest, Vite build, generated API docs, API contract golden snapshots.

---

### Task 1: Contract Test

**Files:**
- Create: `tests/collectible-2d-25d-director.test.js`
- Create: `docs/superpowers/plans/2026-06-25-2d-25d-collectible-director.md`

- [ ] **Step 1: Write the failing test**

Assert `createCollectible2D25DDirectorStep()` handles pickups, magnet targets, drop spawns, inventory deltas, score/combo rewards, feedback, events, debug draw commands, editor panels, and demo wiring.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/collectible-2d-25d-director.test.js`

Expected: FAIL because the public API and demo wiring do not exist yet.

### Task 2: Runtime Module

**Files:**
- Create: `src/gameplay/Collectible2D25DDirector.js`
- Modify: `src/index.js`

- [ ] **Step 1: Implement the Director step**

Return `schema`, `actor`, `collectibles`, `drops`, `magnet`, `pickups`, `inventory`, `score`, `combo`, `lifetime`, `effects`, `events`, `editor`, `runtimeSync`, `debugDraw`, and `quality`.

- [ ] **Step 2: Export the public API**

Export `COLLECTIBLE_2D_25D_SCHEMA` and `createCollectible2D25DDirectorStep` from `src/index.js`.

- [ ] **Step 3: Run the focused test**

Run: `npm test -- tests/collectible-2d-25d-director.test.js`

Expected: PASS.

### Task 3: Official Demo Wiring

**Files:**
- Modify: `examples/2d-25d-platformer-demo/src/main.js`
- Modify: `examples/2d-25d-platformer-demo/README.md`

- [ ] **Step 1: Add collectible runtime usage**

Wire the demo to call `createCollectible2D25DDirectorStep()` each frame with a coin, key, magnet pickup, and enemy drop source.

- [ ] **Step 2: Add visible debug evidence**

Draw collectible objects and add overlay text for `CollectibleDirector / Magnet / InventoryDeltas`.

- [ ] **Step 3: Update README**

Document the collectible director, magnet pickup, and inventory deltas.

### Task 4: Verification and Release

**Files:**
- Modify generated docs and contract snapshots after verification.

- [ ] **Step 1: Run focused and regression tests**

Run the collectible test and focused 2D/2.5D regression suite.

- [ ] **Step 2: Run quality gates**

Run `npm run lint`, `npm run build`, `npm run docs:generate`, and the API contract snapshot test.

- [ ] **Step 3: Commit and push**

Commit with `feat(2d): add collectible director` and push `codex/contract-benchmark-ci`.
