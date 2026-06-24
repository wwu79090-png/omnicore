# 2D/2.5D Authoring Playtest Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real 2D/2.5D creation loop with tilemap editing, prefab/stamp placement, Arcade-driven animation preview, editor playtest payloads, hot reload evidence, and a runnable platformer demo template.

**Architecture:** Add a pure authoring module under `src/tilemap` that consumes tilemap, stamp, animation, and playtest config and returns stable editor/runtime/save/debug payloads. Reuse existing Arcade gameplay and animation concepts, export the new API from `src/index.js`, and ship an example under `examples/2d-25d-platformer-demo`.

**Tech Stack:** JavaScript ESM, Vitest, OmniCore Tilemap/Arcade/Animation APIs, Vite build, generated API docs.

---

### Task 1: Lock The Full 2D/2.5D Authoring Contract

**Files:**
- Create: `tests/tilemap-2d-25d-authoring-loop.test.js`
- Create: `docs/superpowers/plans/2026-06-25-2d-25d-authoring-playtest-loop.md`

- [x] **Step 1: Write failing tests**

Tests assert the new `createTilemap2D25DAuthoringLoop` API and the official `examples/2d-25d-platformer-demo` template.

- [x] **Step 2: Verify RED**

Run: `npm test -- tests/tilemap-2d-25d-authoring-loop.test.js`

Expected: FAIL because the API and demo template are not present yet.

### Task 2: Implement Authoring Loop API

**Files:**
- Create: `src/tilemap/Tilemap2D25DAuthoringLoop.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement tile editing operations**

Support brush, rectangle fill, erase, selection copy, and terrain/autotile rule edits. Return edit list, changed cells, preview bounds, collision painter commands, and hot reload topics.

- [x] **Step 2: Implement stamp/prefab placement**

Support monster, trap, chest, portal, light, and trigger stamps with batch placement, grid snapping, undo/redo commands, resource dependencies, and scene save patch data.

- [x] **Step 3: Implement animation/playtest payloads**

Resolve idle/run/jump/fall/attack/hurt animation state from Arcade state, emit 2.5D Y-sort preview entries, collision/sensor/animation debug panels, and hot reload event flow.

- [x] **Step 4: Export API**

Export `TILEMAP_2D_25D_AUTHORING_SCHEMA` and `createTilemap2D25DAuthoringLoop` from the root package.

### Task 3: Ship Official Demo Template

**Files:**
- Create: `examples/2d-25d-platformer-demo/index.html`
- Create: `examples/2d-25d-platformer-demo/package.json`
- Create: `examples/2d-25d-platformer-demo/README.md`
- Create: `examples/2d-25d-platformer-demo/src/main.js`
- Modify: `package.json`

- [x] **Step 1: Add runnable demo**

The demo must include tilemap rendering, one-way platform, slope, moving platform, sensor, lighting, hero animation state, 2.5D draw sorting, and debug overlay.

- [x] **Step 2: Include in published files**

Add `examples/2d-25d-platformer-demo` to root `package.json` `files`.

### Task 4: Verify And Publish

**Files:**
- Modify generated API docs under `docs/api`.

- [x] **Step 1: Focused tests**

Run: `npm test -- tests/tilemap-2d-25d-authoring-loop.test.js tests/arcade-2d-gameplay-hardening.test.js tests/scene-2d-25d-runtime-editor-closure.test.js`

- [x] **Step 2: 2D/2.5D regression**

Run: `npm test -- tests/omnicore-2d-extreme-runtime.test.js tests/omnicore-2d-performance-crown.test.js tests/editor-cocreation-25d.test.js tests/certify-25d-production.test.js tests/industrial-25d-pipeline.test.js`

- [x] **Step 3: Quality gates**

Run: `npm run lint`

Run: `npm run build`

Run: `npm run docs:generate`

Run: `git diff --check`

- [ ] **Step 4: Commit and push**

Commit message: `feat(2d): add authoring playtest loop`
