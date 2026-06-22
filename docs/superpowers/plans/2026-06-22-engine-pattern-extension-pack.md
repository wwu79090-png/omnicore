# Engine Pattern Extension Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the remaining practical engine patterns from Roblox/Core Games, Ren'Py/RPG Maker, PlayCanvas/Babylon/Armory, Twine/Ink/Yarn, and Source/CryEngine as small OmniCore runtime foundations.

**Architecture:** Add focused runtime/editor-agnostic modules for prefab variants, remote event contracts, dialogue, quest state, material presets, render profiles, narrative scripts, debug probes, and level validation. Each module stays data-driven and is exported through `src/index.js`.

**Tech Stack:** JavaScript ESM, Vitest, OmniCore runtime modules.

---

### Task 1: Contract Tests

**Files:**
- Create: `tests/engine-pattern-extension-pack.test.js`

- [x] **Step 1: Write failing tests**

The test imports `PrefabVariantRegistry`, `RemoteEventContract`, `DialogueGraph`, `QuestStateMachine`, `MaterialPreset`, `RenderFeatureProfile`, `NarrativeRuntime`, `DebugProbe`, and `LevelValidationReport` from `../src/index.js`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engine-pattern-extension-pack.test.js`
Expected: FAIL because these exports are missing.

### Task 2: Prefab and Remote Event Foundations

**Files:**
- Create: `src/prefab/PrefabVariantRegistry.js`
- Create: `src/net/RemoteEventContract.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement prefab base/variant resolution and deterministic instancing**
- [x] **Step 2: Implement remote event payload and direction validation**

### Task 3: Dialogue, Quest, and Narrative Foundations

**Files:**
- Create: `src/data/DialogueGraph.js`
- Create: `src/gameplay/QuestStateMachine.js`
- Create: `src/data/NarrativeRuntime.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement branching dialogue with variables and choice filters**
- [x] **Step 2: Implement staged quest progress and reward completion**
- [x] **Step 3: Implement lightweight Twine/Ink/Yarn-style narrative script runtime**

### Task 4: Material and Render Profile Foundations

**Files:**
- Create: `src/renderer/MaterialPreset.js`
- Create: `src/renderer/RenderFeatureProfile.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement material variant resolution**
- [x] **Step 2: Implement platform render feature and budget profiles**

### Task 5: Debug and Level Validation Foundations

**Files:**
- Create: `src/debug/DebugProbe.js`
- Create: `src/debug/LevelValidationReport.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement runtime debug event/entity snapshots**
- [x] **Step 2: Implement scene duplicate, asset, and spawn-point validation**

### Task 6: Verification

**Files:**
- All modified files

- [x] **Step 1: Run focused tests**

Run: `npm test -- tests/engine-pattern-extension-pack.test.js`

- [x] **Step 2: Run compatibility pack tests**

Run: `npm test -- tests/engine-pattern-extension-pack.test.js tests/cross-engine-foundation-pack.test.js tests/godot-style-production-foundation.test.js`

- [x] **Step 3: Run audit, lint, docs, and build**

Run: `npm run audit:api`
Run: `npm run docs:generate`
Run: `npm run lint`
Run: `npm run build`

- [x] **Step 4: Run public API contract and full test suite**

Result: PASS, 170 test files and 828 tests.

Run: `npm test -- tests/contract/api-contract-snapshot.test.js`
Run: `npm test`
