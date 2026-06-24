# 2D/2.5D Level Gameplay Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen OmniCore 2D/2.5D by adding a production-oriented level gameplay loop for camera zones, combat, collectibles, checkpoints, enemy patrols, events, Y-sort rendering, frame budgets, and debug panels.

**Architecture:** Add a pure deterministic module under `src/gameplay` and export it from `src/index.js`. The module accepts level runtime state and returns editor/runtime payloads that can be consumed by the desktop editor, demos, tests, and export tooling without DOM dependencies.

**Tech Stack:** JavaScript ESM, Vitest, OmniCore existing Tilemap/Arcade/authoring APIs, generated API docs, Vite build.

---

### Task 1: Lock The Level Gameplay Contract

**Files:**
- Create: `tests/level-2d-25d-gameplay-loop.test.js`
- Create: `docs/superpowers/plans/2026-06-25-2d-25d-level-gameplay-loop.md`

- [x] **Step 1: Write failing tests**

The test imports `createLevel2D25DGameplayLoop`, verifies camera zones, combat hitboxes, collectibles, checkpoints, enemy patrols, events, Y-sort render queue, frame budget, editor panels, runtime sync, and demo integration evidence.

- [x] **Step 2: Verify RED**

Run: `npm test -- tests/level-2d-25d-gameplay-loop.test.js`

Expected: FAIL because the API is not exported yet.

### Task 2: Implement Gameplay Loop API

**Files:**
- Create: `src/gameplay/Level2D25DGameplayLoop.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement runtime sections**

Return schema `omnicore.level-2d-25d-gameplay-loop.v1` with camera, combat, collectibles, checkpoints, enemy AI, events, render, performance, debug draw, editor, runtime sync, and quality sections.

- [x] **Step 2: Export API**

Export `LEVEL_2D_25D_GAMEPLAY_SCHEMA` and `createLevel2D25DGameplayLoop` from `src/index.js`.

### Task 3: Integrate Demo Evidence

**Files:**
- Modify: `examples/2d-25d-platformer-demo/src/main.js`
- Modify: `examples/2d-25d-platformer-demo/README.md`

- [x] **Step 1: Use the gameplay loop in the demo**

The demo should import and call `createLevel2D25DGameplayLoop`, surface its debug payload, and mention camera zones, combat, collectibles, checkpoints, patrols, and frame budget in the README.

### Task 4: Verify And Publish

**Files:**
- Modify generated API docs under `docs/api`.

- [x] **Step 1: Focused tests**

Run: `npm test -- tests/level-2d-25d-gameplay-loop.test.js tests/tilemap-2d-25d-authoring-loop.test.js tests/arcade-2d-gameplay-hardening.test.js tests/scene-2d-25d-runtime-editor-closure.test.js`

- [x] **Step 2: 2D/2.5D regression**

Run: `npm test -- tests/omnicore-2d-extreme-runtime.test.js tests/omnicore-2d-performance-crown.test.js tests/editor-cocreation-25d.test.js tests/certify-25d-production.test.js tests/industrial-25d-pipeline.test.js`

- [x] **Step 3: Quality gates**

Run: `npm run lint`

Run: `npm run build`

Run: `npm run docs:generate`

Run: `git diff --check`

- [ ] **Step 4: Commit and push**

Commit message: `feat(2d): add level gameplay loop`
