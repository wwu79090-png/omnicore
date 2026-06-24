# 2D/2.5D Hazard Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-oriented 2D/2.5D hazard director for traps, damage zones, moving hazards, knockback, invulnerability frames, checkpoint respawn, editor panels, and runtime sync.

**Architecture:** Follow the existing gameplay Director pattern: normalize inputs, compute deterministic one-step runtime outputs, return editor/debug/runtime-sync metadata, and wire the official platformer demo as proof of real use.

**Tech Stack:** JavaScript ES modules, Vitest, Vite build, generated API docs, API contract golden snapshots.

---

### Task 1: Contract Test

**Files:**
- Create: `tests/hazard-2d-25d-director.test.js`
- Create: `docs/superpowers/plans/2026-06-25-2d-25d-hazard-director.md`

- [ ] **Step 1: Write the failing test**

Assert `createHazard2D25DDirectorStep()` handles active damage zones, moving hazards, knockback, invulnerability frames, checkpoint respawn, event queues, debug draw commands, editor panels, and demo wiring.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/hazard-2d-25d-director.test.js`

Expected: FAIL because the public API and demo wiring do not exist yet.

### Task 2: Runtime Module

**Files:**
- Create: `src/gameplay/Hazard2D25DDirector.js`
- Modify: `src/index.js`

- [ ] **Step 1: Implement the Director step**

Return `schema`, `actor`, `hazards`, `motion`, `contacts`, `damage`, `response`, `stateUpdates`, `effects`, `events`, `editor`, `runtimeSync`, `debugDraw`, and `quality`.

- [ ] **Step 2: Export the public API**

Export `HAZARD_2D_25D_SCHEMA` and `createHazard2D25DDirectorStep` from `src/index.js`.

- [ ] **Step 3: Run the focused test**

Run: `npm test -- tests/hazard-2d-25d-director.test.js`

Expected: PASS.

### Task 3: Official Demo Wiring

**Files:**
- Modify: `examples/2d-25d-platformer-demo/src/main.js`
- Modify: `examples/2d-25d-platformer-demo/README.md`

- [ ] **Step 1: Add hazard runtime usage**

Wire the demo to call `createHazard2D25DDirectorStep()` each frame with a spike pit and moving saw.

- [ ] **Step 2: Add visible debug evidence**

Draw hazards and add overlay text for `HazardDirector / DamageZones / InvulnerabilityFrames`.

- [ ] **Step 3: Update README**

Document the hazard director, damage zones, and knockback and respawn behavior.

### Task 4: Verification and Release

**Files:**
- Modify generated docs and contract snapshots after verification.

- [ ] **Step 1: Run focused and regression tests**

Run the hazard test and focused 2D/2.5D regression suite.

- [ ] **Step 2: Run quality gates**

Run `npm run lint`, `npm run build`, `npm run docs:generate`, and the API contract snapshot test.

- [ ] **Step 3: Commit and push**

Commit with `feat(2d): add hazard director` and push `codex/contract-benchmark-ci`.
