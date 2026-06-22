# Cross Engine Foundation Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Absorb practical ideas from Unity, Unreal, Cocos, Phaser, Construct, Bevy, Defold, and GameMaker into OmniCore as Web 2D/2.5D foundations.

**Architecture:** Add small data-driven modules instead of large editor/runtime rewrites. Each module owns one concept and is exported through `src/index.js`; existing systems such as `EventSheet`, `SceneManager`, `World`, and `Loader` gain narrow compatibility hooks.

**Tech Stack:** JavaScript ESM, Vitest, OmniCore runtime modules.

---

### Task 1: Contract Tests

**Files:**
- Create: `tests/cross-engine-foundation-pack.test.js`

- [x] **Step 1: Write failing tests**

The test imports `DataAsset`, `GameplayTags`, `AddressableCatalog`, `SystemSchedule`, `CollectionFactory`, `ObjectEventMap`, `AbilitySystem`, `createSceneServices`, `QueryFilter`, and `EventSheet`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cross-engine-foundation-pack.test.js`
Expected: FAIL because new exports and methods are missing.

### Task 2: Unity and Unreal Data Foundations

**Files:**
- Create: `src/data/DataAsset.js`
- Create: `src/core/GameplayTags.js`
- Create: `src/gameplay/AbilitySystem.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement DataAsset variants**
- [x] **Step 2: Implement GameplayTags hierarchy queries**
- [x] **Step 3: Implement AbilitySystem cooldowns and effects**

### Task 3: Cocos and Addressables Resource Foundations

**Files:**
- Create: `src/assets/AddressableCatalog.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement address resolution, bundle grouping, and loader bundle conversion**

### Task 4: Bevy ECS Schedule and Query

**Files:**
- Create: `src/core/SystemSchedule.js`
- Create: `src/core/ECS/QueryFilter.js`
- Modify: `src/core/ECS/index.js`
- Modify: `src/core/ECS/World.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement staged system schedule**
- [x] **Step 2: Implement query filters for components, tags, and changed state**

### Task 5: Defold, Phaser, and GameMaker Runtime Foundations

**Files:**
- Create: `src/scene/CollectionFactory.js`
- Create: `src/scene/ObjectEventMap.js`
- Create: `src/scene/SceneServices.js`
- Modify: `src/scene/SceneManager.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement collection spawning with id maps**
- [x] **Step 2: Implement object event dispatch**
- [x] **Step 3: Implement scene service injection helper and route SceneManager through it**

### Task 6: Construct EventSheet Enhancements

**Files:**
- Modify: `src/data/EventSheet.js`

- [x] **Step 1: Add groups, function event calls, and trace output**

### Task 7: Verification

**Files:**
- All modified files

- [x] **Step 1: Run focused tests**

Run: `npm test -- tests/cross-engine-foundation-pack.test.js tests/godot-style-production-foundation.test.js`

- [x] **Step 2: Run related regression tests**

Run: `npm test -- tests/deep-engine-bindings.test.js tests/advanced-capabilities.test.js tests/omnicore.test.js tests/advanced-2d-systems.test.js`

- [x] **Step 3: Run lint**

Run: `npm run lint`

- [x] **Step 4: Run build**

- [x] **Step 5: Run full suite and update API golden**

Run: `npm test`
Result: PASS, 169 files and 821 tests.

Run: `npm run build`
