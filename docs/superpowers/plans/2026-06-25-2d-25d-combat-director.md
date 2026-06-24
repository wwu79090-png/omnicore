# 2D/2.5D Combat Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-oriented 2D/2.5D combat director for hitbox/hurtbox resolution, team filtering, blocks, parries, damage, knockback, stagger, hitstop, combo windows, editor panels, and runtime sync.

**Architecture:** Follow the existing gameplay Director pattern. The module normalizes attackers, defenders, hitboxes, hurtboxes, guard state, and combo state, then emits deterministic one-step combat outputs plus editor/debug/runtime-sync metadata.

**Tech Stack:** JavaScript ES modules, Vitest, Vite build, generated API docs, API contract golden snapshots.

---

### Task 1: Contract Test

**Files:**
- Create: `tests/combat-2d-25d-director.test.js`
- Create: `docs/superpowers/plans/2026-06-25-2d-25d-combat-director.md`

- [ ] **Step 1: Write the failing test**

Assert `createCombat2D25DDirectorStep()` handles active attacks, hitbox/hurtbox overlap, team filtering, block/parry outcomes, damage, knockback, stagger, hitstop, combo windows, feedback, events, debug draw commands, editor panels, and demo wiring.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/combat-2d-25d-director.test.js`

Expected: FAIL because the public API and demo wiring do not exist yet.

### Task 2: Runtime Module

**Files:**
- Create: `src/gameplay/Combat2D25DDirector.js`
- Modify: `src/index.js`

- [ ] **Step 1: Implement the Director step**

Return `schema`, `attackers`, `defenders`, `hitDetection`, `guards`, `damage`, `response`, `combo`, `effects`, `events`, `editor`, `runtimeSync`, `debugDraw`, and `quality`.

- [ ] **Step 2: Export the public API**

Export `COMBAT_2D_25D_SCHEMA` and `createCombat2D25DDirectorStep` from `src/index.js`.

- [ ] **Step 3: Run the focused test**

Run: `npm test -- tests/combat-2d-25d-director.test.js`

Expected: PASS.

### Task 3: Official Demo Wiring

**Files:**
- Modify: `examples/2d-25d-platformer-demo/src/main.js`
- Modify: `examples/2d-25d-platformer-demo/README.md`

- [ ] **Step 1: Add combat runtime usage**

Wire the demo to call `createCombat2D25DDirectorStep()` each frame with the hero sword attack and enemy hurtbox.

- [ ] **Step 2: Add visible debug evidence**

Draw attack hitboxes and add overlay text for `CombatDirector / Hitboxes / ParryWindows`.

- [ ] **Step 3: Update README**

Document the combat director, hitbox/hurtbox resolver, and parry windows.

### Task 4: Verification and Release

**Files:**
- Modify generated docs and contract snapshots after verification.

- [ ] **Step 1: Run focused and regression tests**

Run the combat test and focused 2D/2.5D regression suite.

- [ ] **Step 2: Run quality gates**

Run `npm run lint`, `npm run build`, `npm run docs:generate`, and the API contract snapshot test.

- [ ] **Step 3: Commit and push**

Commit with `feat(2d): add combat director` and push `codex/contract-benchmark-ci`.
