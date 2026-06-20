# OmniCore 2.5D Editor Certification Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the 2.5D editor loop by adding visual proof, real bundle certification, and save history rollback/diff.

**Architecture:** Keep the editor as the source of project-state truth. Add descriptor-only visual evidence to editor exports, teach the certification script to consume either the official demo or a real exported bundle, and expose compact save-version helpers without changing renderer internals.

**Tech Stack:** JavaScript ESM, Vitest, jsdom editor tests, Node CLI scripts.

---

### Task 1: Visual 2.5D Evidence

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `tests/editor-cocreation-25d.test.js`
- Modify: `docs/25d-living-world.md`

- [x] **Step 1: Write the failing test**

Add a test that calls `app.create25DVisualEvidence()` after planning/applying/saving and expects occlusion, shadow, event, entity, and screenshot descriptors plus a `reports/25d-visual-evidence.json` file in `exportProductionDeploymentBundle()`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/editor-cocreation-25d.test.js`

- [x] **Step 3: Write minimal implementation**

Expose `create25DVisualEvidence(options)` from the editor app, render visual proof rows in the production panel, and attach the visual report to production deployment exports.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/editor-cocreation-25d.test.js`

### Task 2: Real Bundle Certification

**Files:**
- Modify: `scripts/certify-25d-production.js`
- Modify: `tests/certify-25d-production.test.js`
- Modify: `docs/25d-living-world.md`

- [x] **Step 1: Write the failing test**

Create a real bundle JSON file from editor-style data and call `create25DProductionCertification({ bundlePath })`. Expect source type `bundle`, stage evidence from the bundle, readiness preservation, and budget failure when bundle files exceed `--max-files`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/certify-25d-production.test.js`

- [x] **Step 3: Write minimal implementation**

Parse `--bundle`, normalize `OmniCore.ProductionDeploymentBundle` and `OmniCore.LightweightDeploymentBundle`, feed their manifest/files/readiness into `createEditorDeployBenchmark25D()`, and prefer bundle evidence over the official demo path.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/certify-25d-production.test.js`

### Task 3: Save Versions, Diff, Rollback

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `tests/editor-cocreation-25d.test.js`
- Modify: `docs/25d-living-world.md`

- [x] **Step 1: Write the failing test**

Save two versions around a 2.5D co-creation change, call `listSaveVersions()`, `diffSaveVersions()`, and `rollbackToSaveVersion()`, then assert added/removed entity ids and scene restoration.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/editor-cocreation-25d.test.js`

- [x] **Step 3: Write minimal implementation**

Maintain `savedVersions`, add version IDs to `saveSnapshot()`, implement list/diff/rollback helpers, and keep current scene tabs and history consistent after rollback.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/editor-cocreation-25d.test.js`

### Task 4: Final Verification

**Files:**
- All touched files.

- [x] **Step 1: Run focused tests**

Run: `npx vitest run tests/editor-cocreation-25d.test.js tests/certify-25d-production.test.js tests/omnicore-25d-living-world-suite.test.js`

- [x] **Step 2: Run focused lint**

Run: `npx eslint -c .eslintrc.json --no-eslintrc packages/omnicore-editor/src/editor-app.js scripts/certify-25d-production.js tests/editor-cocreation-25d.test.js tests/certify-25d-production.test.js`

- [x] **Step 3: Run full quality gates**

Run: `npm test -- --run`, `npm run lint`, `npm run build`, `git diff --check`.
