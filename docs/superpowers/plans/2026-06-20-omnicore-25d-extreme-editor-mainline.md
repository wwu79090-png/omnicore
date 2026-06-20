# OmniCore 2.5D Extreme Editor Mainline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push OmniCore's main differentiator to a production-grade 2.5D editor path: readiness gate, visible workflow panel, and official demo/benchmark evidence.

**Architecture:** Extend the existing editor app API rather than creating a parallel system. The production gate consumes the lightweight deployment bundle and authoring health report; the visual panel renders stable DOM markers from that same report; the demo/benchmark evidence is a small deterministic Node module used by tests and docs.

**Tech Stack:** JavaScript ESM, Vitest, existing DOM editor app, existing benchmark conventions, no new dependencies.

---

### Task 1: 2.5D Production Gate

**Files:**
- Modify: `tests/editor-cocreation-25d.test.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `docs/25d-living-world.md`

- [x] **Step 1: Write failing tests**

Extend the editor co-creation test to require `create25DProductionReadinessReport()` and `exportProductionDeploymentBundle()`. The report must block an unapplied co-creation plan, pass after apply/save/export, and expose score, blockers, warnings, evidence, and nextActions.

- [x] **Step 2: Run RED**

Run: `npx vitest run tests/editor-cocreation-25d.test.js`
Expected: FAIL because `create25DProductionReadinessReport` is missing.

- [x] **Step 3: Implement minimal production gate**

Add editor API methods that inspect current scene, scene tabs, build targets, asset references, authoring health, and lightweight deployment manifest. Keep it deterministic and data-only.

- [x] **Step 4: Run GREEN**

Run: `npx vitest run tests/editor-cocreation-25d.test.js`
Expected: PASS with no warnings.

### Task 2: Editor Visual Workflow Panel

**Files:**
- Modify: `tests/editor-cocreation-25d.test.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `docs/25d-living-world.md`

- [x] **Step 1: Write failing DOM test**

Require a `[data-25d-production-panel]` panel with stable stage markers for plan/apply/save/export/readiness and a production score marker.

- [x] **Step 2: Run RED**

Run: `npx vitest run tests/editor-cocreation-25d.test.js`
Expected: FAIL because the panel is missing.

- [x] **Step 3: Render the panel**

Add a compact floating panel to existing transient editor surfaces. It must read from current state and existing readiness helpers, not duplicate business logic.

- [x] **Step 4: Run GREEN**

Run: `npx vitest run tests/editor-cocreation-25d.test.js`
Expected: PASS with no warnings.

### Task 3: Official Demo And Benchmark Evidence

**Files:**
- Create: `src/livingworld/EditorDeployBenchmark25D.js`
- Modify: `src/livingworld/index.js`
- Modify: `src/index.js`
- Create: `examples/25d-editor-deploy-loop.json`
- Modify: `tests/omnicore-25d-living-world-suite.test.js`
- Modify: `docs/25d-living-world.md`

- [x] **Step 1: Write failing runtime evidence test**

Require an exported `createEditorDeployBenchmark25D()` helper and an example JSON file describing the plan/apply/save/export/readiness path.

- [x] **Step 2: Run RED**

Run: `npx vitest run tests/omnicore-25d-living-world-suite.test.js`
Expected: FAIL because the helper and example are missing.

- [x] **Step 3: Implement deterministic evidence helper**

Add a tiny module that reports stages, bundle profile, target size budget, and pass/fail readiness evidence from a bundle-like input.

- [x] **Step 4: Run GREEN**

Run: `npx vitest run tests/omnicore-25d-living-world-suite.test.js`
Expected: PASS with no warnings.

### Task 4: Verification

**Files:**
- All files touched above.

- [x] **Step 1: Run focused tests**

Run:
`npx vitest run tests/editor-cocreation-25d.test.js tests/omnicore-25d-living-world-suite.test.js tests/editor-industrial-authoring.test.js`

- [x] **Step 2: Run lint**

Run:
`npx eslint -c .eslintrc.json --no-eslintrc packages/omnicore-editor/src/editor-app.js src/livingworld/*.js src/index.js tests/editor-cocreation-25d.test.js tests/omnicore-25d-living-world-suite.test.js`

- [x] **Step 3: Run full verification**

Run:
`npm test -- --run`
`npm run lint`
`npm run build`
`git diff --check`
