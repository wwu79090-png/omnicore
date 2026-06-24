# 2D/2.5D Interactable Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-oriented 2D/2.5D interactable director for prompts, switches, doors, chests, NPC dialogue, checkpoints, event queues, editor panels, and runtime sync.

**Architecture:** Follow the existing Director-step pattern used by Platformer, Encounter, AnimationFeedback, Camera, and Projectile modules. The new gameplay file returns normalized inputs plus deterministic step outputs so editor playtest, runtime, and tests all consume the same contract.

**Tech Stack:** JavaScript ES modules, Vitest, Vite build, generated API docs, API contract golden snapshots.

---

### Task 1: Contract Test

**Files:**
- Create: `tests/interactable-2d-25d-director.test.js`
- Create: `docs/superpowers/plans/2026-06-25-2d-25d-interactable-director.md`

- [ ] **Step 1: Write the failing test**

Test `createInteractable2D25DDirectorStep()` from `src/index.js` with a hero, switch, door, chest, NPC, and checkpoint.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/interactable-2d-25d-director.test.js`

Expected: FAIL because the public API and demo wiring do not exist yet.

### Task 2: Runtime Module

**Files:**
- Create: `src/gameplay/Interactable2D25DDirector.js`
- Modify: `src/index.js`

- [ ] **Step 1: Implement the Director step**

Return `schema`, `player`, `interactables`, `prompts`, `interactions`, `stateUpdates`, `effects`, `events`, `editor`, `runtimeSync`, `debugDraw`, and `quality`.

- [ ] **Step 2: Export the public API**

Export `INTERACTABLE_2D_25D_SCHEMA` and `createInteractable2D25DDirectorStep` from `src/index.js`.

- [ ] **Step 3: Run the focused test**

Run: `npm test -- tests/interactable-2d-25d-director.test.js`

Expected: PASS.

### Task 3: Official Demo Wiring

**Files:**
- Modify: `examples/2d-25d-platformer-demo/src/main.js`
- Modify: `examples/2d-25d-platformer-demo/README.md`

- [ ] **Step 1: Add interactable runtime usage**

Wire the demo to call `createInteractable2D25DDirectorStep()` each frame with a switch, door, chest, NPC, and checkpoint.

- [ ] **Step 2: Add visible debug evidence**

Draw the switch, door, chest, NPC, and prompt state, and add overlay text for `InteractableDirector / Switches / Doors / Chests`.

- [ ] **Step 3: Update README**

Document the interactable director, switches and doors, chests and checkpoints.

### Task 4: Verification and Release

**Files:**
- Modify generated docs and contract snapshots after verification.

- [ ] **Step 1: Run focused and regression tests**

Run the interactable test and focused 2D/2.5D regression suite.

- [ ] **Step 2: Run quality gates**

Run `npm run lint`, `npm run build`, `npm run docs:generate`, and the API contract snapshot test.

- [ ] **Step 3: Commit and push**

Commit with `feat(2d): add interactable director` and push `codex/contract-benchmark-ci`.
