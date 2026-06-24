# 2D/2.5D Arcade Gameplay Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OmniCore's 2D/2.5D runtime stronger for real platformer and top-down projects by adding an editor-ready Arcade gameplay plan with one-way platforms, slopes, sensors, moving platforms, debug draw, and pipeline integration.

**Architecture:** Add a pure deterministic physics authoring/simulation helper in `src/physics/Arcade2DGameplayKit.js`, export it through `src/physics/Physics.js` and `src/index.js`, and wire it into `createScene2D25DPipeline` when `arcade2D` config is provided. The helper returns stable runtime, editor, debug, and quality sections without depending on DOM or Canvas.

**Tech Stack:** JavaScript ESM, Vitest, existing OmniCore `Tilemap`, `Camera`, `Light2D`, `Scene2D25DPipeline`, ESLint, Vite build.

---

### Task 1: Lock the Arcade 2D Gameplay Contract

**Files:**
- Create: `tests/arcade-2d-gameplay-hardening.test.js`
- Create: `docs/superpowers/plans/2026-06-25-2d-25d-arcade-gameplay-hardening.md`

- [x] **Step 1: Write the failing test**

The test imports `createArcade2DGameplayPlan` and checks one-way platforms, slopes, sensors, moving platforms, debug draw, editor sections, and scene pipeline integration.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/arcade-2d-gameplay-hardening.test.js`

Expected: FAIL because `createArcade2DGameplayPlan` is not exported yet.

### Task 2: Implement Arcade 2D Gameplay Kit

**Files:**
- Create: `src/physics/Arcade2DGameplayKit.js`
- Modify: `src/physics/Physics.js`
- Modify: `src/index.js`
- Modify: `src/tilemap/Scene2D25DPipeline.js`

- [x] **Step 1: Implement `createArcade2DGameplayPlan`**

The function should return schema `omnicore.arcade-2d-gameplay-plan.v1`, normalize actors/colliders/sensors, resolve one-way platforms, resolve slope floor position, carry actors on moving platforms, emit sensor events, debug draw, editor metadata, and quality checks.

- [x] **Step 2: Export it**

Export `ARCADE_2D_GAMEPLAY_SCHEMA` and `createArcade2DGameplayPlan` from `src/physics/Physics.js` and root `src/index.js`.

- [x] **Step 3: Wire it into the 2D/2.5D scene pipeline**

When `config.arcade2D` exists, add `pipeline.arcade2D`, append `Arcade2DGameplay` editor panel/inspector metadata, include `arcade2D` runtime sync payload, and add an Arcade gameplay quality check.

### Task 3: Verify And Ship

**Files:**
- Modify generated API docs under `docs/api` if build/docs generation updates them.

- [x] **Step 1: Run focused tests**

Run: `npm test -- tests/arcade-2d-gameplay-hardening.test.js tests/scene-2d-25d-runtime-editor-closure.test.js tests/advanced-2d-systems.test.js`

- [x] **Step 2: Run broader 2D/2.5D regression**

Run: `npm test -- tests/omnicore-2d-extreme-runtime.test.js tests/omnicore-2d-performance-crown.test.js tests/editor-cocreation-25d.test.js tests/certify-25d-production.test.js tests/industrial-25d-pipeline.test.js`

- [x] **Step 3: Run quality gates**

Run: `npm run lint`

Run: `npm run build`

Run: `npm run docs:generate`

Run: `git diff --check`

- [ ] **Step 4: Commit and push**

Commit message: `feat(2d): harden arcade gameplay loop`
