# Engine Pattern Scalability Optimization Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close remaining production-engine gaps around world streaming, render pass optimization, shader variant preparation, input action contexts, and save-game migration.

**Architecture:** Add five independent pure-runtime modules inspired by Unreal Engine World Partition/Data Layers and Enhanced Input, Unity Render Graph and Shader Variant Collections, and Unreal SaveGame slots. Each module remains data-oriented, deterministic, and exported through `src/index.js`.

**Tech Stack:** JavaScript ESM, Vitest, OmniCore runtime modules.

---

### Task 1: Contract Tests

**Files:**
- Create: `tests/engine-pattern-scalability-optimization-pack.test.js`

- [x] **Step 1: Write failing tests**

The test imports `WorldPartitionGrid`, `RenderGraphPlanner`, `ShaderVariantCollection`, `InputActionContextStack`, and `SaveGameArchive` from `../src/index.js`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engine-pattern-scalability-optimization-pack.test.js`
Expected: FAIL because the new exports are missing.

### Task 2: Streaming and Rendering Optimization Foundations

**Files:**
- Create: `src/scene/WorldPartitionGrid.js`
- Create: `src/renderer/RenderGraphPlanner.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement Unreal-style runtime grid streaming with active data layers**
- [x] **Step 2: Implement Unity-style render graph planning with resource dependency order and unused pass culling**

### Task 3: Shader and Input Production Foundations

**Files:**
- Create: `src/renderer/ShaderVariantCollection.js`
- Create: `src/input/InputActionContextStack.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement Unity-style shader variant capture, dedupe, strip, and warmup planning**
- [x] **Step 2: Implement Unreal/Unity-style input action contexts with priority, triggers, and modifiers**

### Task 4: SaveGame Migration Foundations

**Files:**
- Create: `src/store/SaveGameArchive.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement Unreal-style user/slot save records with schema version migration**

### Task 5: Verification

**Files:**
- All modified files

- [x] **Step 1: Run focused tests**

Run: `npm test -- tests/engine-pattern-scalability-optimization-pack.test.js`

- [x] **Step 2: Run related engine pattern pack tests**

Run: `npm test -- tests/engine-pattern-scalability-optimization-pack.test.js tests/engine-pattern-lifecycle-component-pack.test.js tests/engine-pattern-script-event-pack.test.js tests/engine-pattern-interaction-pack.test.js tests/engine-pattern-platform-pack.test.js tests/engine-pattern-production-pack.test.js tests/engine-pattern-extension-pack.test.js tests/cross-engine-foundation-pack.test.js tests/godot-style-production-foundation.test.js`

- [x] **Step 3: Run audit, lint, docs, build, and API contract**

Run: `npm run audit:api`
Run: `npm run lint`
Run: `npm run docs:generate`
Run: `npm run build`
Run: `npm test -- tests/contract/api-contract-snapshot.test.js`

- [x] **Step 4: Run full test suite**

Run: `npm test`
