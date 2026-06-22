# Engine Pattern Production Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add another practical cross-engine pack inspired by Flax, O3DE, Stride, MonoGame, libGDX, LÖVE, GDevelop, and PICO-8 without changing OmniCore's Web 2D/2.5D positioning.

**Architecture:** Add small data-driven modules for game settings, asset build recipes, runtime serialization, reusable behaviors, scene transition stacks, virtual asset packaging, and module/gem manifests. Each module owns one concept, uses OmniCore error wrappers, and is exported through `src/index.js`.

**Tech Stack:** JavaScript ESM, Vitest, OmniCore runtime modules.

---

### Task 1: Contract Tests

**Files:**
- Create: `tests/engine-pattern-production-pack.test.js`

- [x] **Step 1: Write failing tests**

The test imports `GameSettingsProfile`, `AssetBuildRecipe`, `RuntimeStateSerializer`, `BehaviorDefinition`, `SceneTransitionStack`, `VirtualAssetFS`, and `ModuleGemManifest` from `../src/index.js`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engine-pattern-production-pack.test.js`
Expected: FAIL because the new exports are missing.

### Task 2: Settings and Asset Pipeline

**Files:**
- Create: `src/platform/GameSettingsProfile.js`
- Create: `src/assets/AssetBuildRecipe.js`
- Create: `src/assets/VirtualAssetFS.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement Stride-style centralized settings with platform overrides**
- [x] **Step 2: Implement O3DE/MonoGame-style source-to-product asset build recipes**
- [x] **Step 3: Implement PICO-8/LÖVE-style virtual asset filesystem packaging**

### Task 3: Runtime Serialization and Behaviors

**Files:**
- Create: `src/core/RuntimeStateSerializer.js`
- Create: `src/data/BehaviorDefinition.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement Flax-style serializable runtime state snapshots and patches**
- [x] **Step 2: Implement GDevelop-style reusable behavior definitions**

### Task 4: Scene Flow and Modular Feature Manifests

**Files:**
- Create: `src/scene/SceneTransitionStack.js`
- Create: `src/core/ModuleGemManifest.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement LÖVE/HaxeFlixel-style scene state stack transitions**
- [x] **Step 2: Implement O3DE-style module/gem manifest dependency validation and activation ordering**

### Task 5: Verification

**Files:**
- All modified files

- [x] **Step 1: Run focused tests**

Run: `npm test -- tests/engine-pattern-production-pack.test.js`

- [x] **Step 2: Run all engine pattern pack tests**

Run: `npm test -- tests/engine-pattern-production-pack.test.js tests/engine-pattern-extension-pack.test.js tests/cross-engine-foundation-pack.test.js tests/godot-style-production-foundation.test.js`

- [x] **Step 3: Run audit, lint, docs, build, and API contract**

Run: `npm run audit:api`
Run: `npm run lint`
Run: `npm run docs:generate`
Run: `npm run build`
Run: `npm test -- tests/contract/api-contract-snapshot.test.js`

- [x] **Step 4: Run full test suite**

Run: `npm test`
Result: PASS, 171 test files and 834 tests.
