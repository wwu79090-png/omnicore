# Engine Commercial Closure Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a commercial closure gate that turns scattered quality, completeness, limit, evidence, and production planning data into one release-ready report.

**Architecture:** Create a focused `src/quality/EngineCommercialClosureGate.js` module that composes existing quality modules instead of duplicating their scoring logic. Export both a class and a convenience `createEngineCommercialClosureReport()` helper through `src/index.js`.

**Tech Stack:** JavaScript ESM, Vitest, existing OmniCore quality modules.

---

### Task 1: Commercial Closure Gate API

**Files:**
- Create: `src/quality/EngineCommercialClosureGate.js`
- Modify: `src/index.js`
- Test: `tests/engine-commercial-closure-gate.test.js`

- [x] **Step 1: Write the failing test**

Add a test that imports `EngineCommercialClosureGate` and `createEngineCommercialClosureReport` from `../src/index.js`, feeds completeness domains, feature quality scores, hard limits, evidence issues, and production scope, then expects a blocked commercial report with priority blockers, verification commands, editor next actions, and connected loops.

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/engine-commercial-closure-gate.test.js`

Expected: fail because the new API does not exist.

- [x] **Step 3: Implement the module**

Compose `EngineCompletenessMatrix`, `EngineFunctionQualityMatrix`, `CompletenessClosurePlanner`, `LimitRemovalPlanner`, and `SoloProductionPlanner`. Normalize blocker priorities, deduplicate verification commands, calculate an overall score, and mark commercial readiness only when completeness, quality, limits, and evidence are all clear.

- [x] **Step 4: Export the API**

Import the module in `src/index.js`, expose it at top level, inside `CompletenessTools`, and in the default export.

- [x] **Step 5: Verify focused tests and API contract**

Run the focused new test, related quality tests, lint/build/docs/API contract checks, update API snapshot only if the public export change is the expected difference.
