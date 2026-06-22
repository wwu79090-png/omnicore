# Engine Pattern Platform Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add another practical engine pattern pack inspired by Playdate, Solar2D, HaxeFlixel, raylib, TIC-80, and PICO-8 style workflows.

**Architecture:** Add small modules for system menu modeling, composer-like scene flows, persistent save slots, runtime config flags, action-based input mapping, and fantasy-console asset banks. Keep modules pure-data where possible and export them through `src/index.js`.

**Tech Stack:** JavaScript ESM, Vitest, OmniCore runtime modules.

---

### Task 1: Contract Tests

**Files:**
- Create: `tests/engine-pattern-platform-pack.test.js`

- [x] **Step 1: Write failing tests**

The test imports `SystemMenuModel`, `ComposerSceneFlow`, `PersistentSaveSlot`, `RuntimeConfigFlags`, `InputDeviceMap`, and `FantasyConsoleBank` from `../src/index.js`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engine-pattern-platform-pack.test.js`
Expected: FAIL because the new exports are missing.

### Task 2: Platform Menu and Save Foundations

**Files:**
- Create: `src/platform/SystemMenuModel.js`
- Create: `src/store/PersistentSaveSlot.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement Playdate-style system menu limits and typed items**
- [x] **Step 2: Implement HaxeFlixel-style local save slots with bind/flush/load/reset**

### Task 3: Scene Flow and Runtime Flags

**Files:**
- Create: `src/scene/ComposerSceneFlow.js`
- Create: `src/platform/RuntimeConfigFlags.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement Solar2D Composer-style scene lifecycle and overlays**
- [x] **Step 2: Implement raylib-style named config flags without bitwise operations**

### Task 4: Input and Fantasy Console Banks

**Files:**
- Create: `src/input/InputDeviceMap.js`
- Create: `src/assets/FantasyConsoleBank.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement keyboard/gamepad action mapping**
- [x] **Step 2: Implement fantasy-console palette, sprite, map, and sound banks**

### Task 5: Verification

**Files:**
- All modified files

- [x] **Step 1: Run focused tests**

Run: `npm test -- tests/engine-pattern-platform-pack.test.js`

- [x] **Step 2: Run all engine pattern pack tests**

Run: `npm test -- tests/engine-pattern-platform-pack.test.js tests/engine-pattern-production-pack.test.js tests/engine-pattern-extension-pack.test.js tests/cross-engine-foundation-pack.test.js tests/godot-style-production-foundation.test.js`

- [x] **Step 3: Run audit, lint, docs, build, and API contract**

Run: `npm run audit:api`
Run: `npm run lint`
Run: `npm run docs:generate`
Run: `npm run build`
Run: `npm test -- tests/contract/api-contract-snapshot.test.js`

- [x] **Step 4: Run full test suite**

Run: `npm test`
Result: PASS, 172 test files and 839 tests.
