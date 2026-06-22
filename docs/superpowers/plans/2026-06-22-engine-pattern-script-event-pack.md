# Engine Pattern Script Event Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue learning practical patterns from Ren'Py, RPG Maker, Defold, GameMaker, and Bevy, then add engine-neutral runtime modules to OmniCore.

**Architecture:** Add pure-data/runtime modules for visual-novel label/menu flow, RPG event page selection, addressed message routing with collection proxy lifecycle, object lifecycle/alarms/timelines, and resource/state-conditioned scheduling. Export every module through `src/index.js`.

**Tech Stack:** JavaScript ESM, Vitest, OmniCore runtime modules.

---

### Task 1: Contract Tests

**Files:**
- Create: `tests/engine-pattern-script-event-pack.test.js`

- [x] **Step 1: Write failing tests**

The test imports `VisualNovelScript`, `RpgEventPageResolver`, `MessageRouteBus`, `ObjectTimelineRuntime`, and `ResourceStateScheduler` from `../src/index.js`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engine-pattern-script-event-pack.test.js`
Expected: FAIL because the new exports are missing.

### Task 2: Script and Event Authoring Foundations

**Files:**
- Create: `src/data/VisualNovelScript.js`
- Create: `src/data/RpgEventPageResolver.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement Ren'Py-style labels, menus, jump/call/return, variable interpolation**
- [x] **Step 2: Implement RPG Maker-style event page condition resolution and trigger metadata**

### Task 3: Message and Object Runtime Foundations

**Files:**
- Create: `src/core/MessageRouteBus.js`
- Create: `src/scene/ObjectTimelineRuntime.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement Defold-style URL-addressed message routing and collection proxy lifecycle**
- [x] **Step 2: Implement GameMaker-style create/step/draw events, alarms, and timeline frame actions**

### Task 4: Resource State Scheduling Foundations

**Files:**
- Create: `src/core/ResourceStateScheduler.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement Bevy-style resources, app states, transition hooks, run conditions, and schedule reports**

### Task 5: Verification

**Files:**
- All modified files

- [x] **Step 1: Run focused tests**

Run: `npm test -- tests/engine-pattern-script-event-pack.test.js`

- [x] **Step 2: Run related engine pattern pack tests**

Run: `npm test -- tests/engine-pattern-script-event-pack.test.js tests/engine-pattern-interaction-pack.test.js tests/engine-pattern-platform-pack.test.js tests/engine-pattern-production-pack.test.js tests/engine-pattern-extension-pack.test.js tests/cross-engine-foundation-pack.test.js tests/godot-style-production-foundation.test.js`

- [x] **Step 3: Run audit, lint, docs, build, and API contract**

Run: `npm run audit:api`
Run: `npm run lint`
Run: `npm run docs:generate`
Run: `npm run build`
Run: `npm test -- tests/contract/api-contract-snapshot.test.js`

- [x] **Step 4: Run full test suite**

Run: `npm test`
