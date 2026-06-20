# OmniCore 2.5D Editor Deploy Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn 2.5D editor co-creation from a preview-only descriptor into an apply-save-export loop for lightweight deployment.

**Architecture:** Keep the loop inside the existing DOM editor API. `plan25DCoCreation()` remains the deterministic planner; `apply25DCoCreationPlan()` converts a plan into a scene entity and history entry; `exportLightweightDeploymentBundle()` reuses the authoring bundle to produce scene files and a deploy-lite manifest.

**Tech Stack:** JavaScript ESM, Vitest, existing editor app state helpers, no new dependencies.

---

### Task 1: Co-Creation Apply, Save, Export Loop

**Files:**
- Modify: `tests/editor-cocreation-25d.test.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `docs/25d-living-world.md`

- [x] **Step 1: Write the failing test**

Add a test that plans a tower behind a forest, applies the plan, saves a snapshot, and exports a lightweight deployment bundle containing the updated scene and deploy-lite manifest.

- [x] **Step 2: Run RED**

Run: `npx vitest run tests/editor-cocreation-25d.test.js`
Expected: FAIL with `app.apply25DCoCreationPlan is not a function`.

- [x] **Step 3: Implement the editor API**

Add `apply25DCoCreationPlan(plan)` and `exportLightweightDeploymentBundle(options)` to `createEditorApp()`. The apply method must update the current scene, mark the active scene tab dirty, select the new entity, emit an editor event, and push history. The export method must emit a deterministic `OmniCore.LightweightDeploymentBundle` with scene files, build targets, referenced assets, and co-creation plan count.

- [x] **Step 4: Run GREEN**

Run: `npx vitest run tests/editor-cocreation-25d.test.js`
Expected: PASS with no errors or warnings.

- [x] **Step 5: Verify adjacent quality**

Run:
`npx vitest run tests/editor-cocreation-25d.test.js tests/omnicore-25d-living-world-suite.test.js tests/editor-industrial-authoring.test.js`
`npx eslint -c .eslintrc.json --no-eslintrc packages/omnicore-editor/src/editor-app.js tests/editor-cocreation-25d.test.js`
Expected: PASS with no output warnings.
