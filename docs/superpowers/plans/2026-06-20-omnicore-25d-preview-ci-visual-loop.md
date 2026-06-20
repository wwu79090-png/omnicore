# OmniCore 2.5D Preview CI Visual Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 2.5D editor certification path into a UI-visible, locally previewable, CI-certified, screenshot-backed loop.

**Architecture:** Keep editor state operations in `packages/omnicore-editor/src/editor-app.js`. Add small Node ESM scripts for bundle preview and Playwright screenshot capture so CI and local release workflows can reuse the same production bundle input.

**Tech Stack:** JavaScript ESM, Vitest, jsdom editor tests, Node HTTP server, Playwright Chromium, GitHub Actions.

---

### Task 1: Save Version UI

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `tests/editor-cocreation-25d.test.js`

- [x] **Step 1: Write the failing test**

Add a test that saves before and after 2.5D co-creation, verifies a rendered save version panel, checks added entity diff text, clicks rollback, and verifies the scene returns to the pre-co-creation state.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/editor-cocreation-25d.test.js`

- [x] **Step 3: Write minimal implementation**

Render save versions inside the existing 2.5D production panel using `listSaveVersions()`, `diffSaveVersions()`, and `rollbackToSaveVersion()`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/editor-cocreation-25d.test.js`

### Task 2: Real Bundle Preview Server

**Files:**
- Create: `scripts/preview-25d-bundle.js`
- Modify: `package.json`
- Create: `examples/25d-editor-deploy-loop.production-bundle.json`
- Create: `tests/preview-25d-bundle.test.js`

- [x] **Step 1: Write the failing test**

Test `create25DBundlePreviewHtml()` and `create25DBundlePreviewServer()` with a temp production bundle. Assert the served HTML includes the co-created entity, deploy profile, readiness, and visual evidence.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/preview-25d-bundle.test.js`

- [x] **Step 3: Write minimal implementation**

Implement an HTTP server that reads a production bundle JSON file, renders a lightweight 2.5D preview scene, and exposes `/bundle.json` plus `/`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/preview-25d-bundle.test.js`

### Task 3: CI Bundle Certification

**Files:**
- Create: `.github/workflows/25d-production.yml`
- Modify: `tests/device-matrix-publish-ci.test.js`

- [x] **Step 1: Write the failing test**

Assert the workflow installs Node, runs `npm run certify:25d -- --bundle examples/25d-editor-deploy-loop.production-bundle.json`, runs the screenshot capture script, and uploads release artifacts.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/device-matrix-publish-ci.test.js`

- [x] **Step 3: Write minimal implementation**

Add a dedicated GitHub Actions workflow for pull requests, pushes to main, and manual dispatch.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/device-matrix-publish-ci.test.js`

### Task 4: Playwright Screenshot Evidence

**Files:**
- Create: `scripts/capture-25d-preview.js`
- Modify: `package.json`
- Create: `tests/capture-25d-preview.test.js`

- [x] **Step 1: Write the failing test**

Test the evidence report formatter and CLI dry path for screenshot output paths, nonblank budget, and certification linkage.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/capture-25d-preview.test.js`

- [x] **Step 3: Write minimal implementation**

Start the preview server, launch Playwright Chromium, capture a screenshot, assert nontrivial PNG bytes, and write JSON evidence.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/capture-25d-preview.test.js`

### Task 5: Verification

**Files:**
- All touched files.

- [x] **Step 1: Run focused tests**

Run: `npx vitest run tests/editor-cocreation-25d.test.js tests/preview-25d-bundle.test.js tests/capture-25d-preview.test.js tests/device-matrix-publish-ci.test.js tests/certify-25d-production.test.js`

- [x] **Step 2: Run scripts**

Run: `npm run certify:25d -- --bundle examples/25d-editor-deploy-loop.production-bundle.json --generated-at 2026-06-20T00:00:00.000Z` and `npm run capture:25d -- --generated-at 2026-06-20T00:00:00.000Z`.

- [x] **Step 3: Run full gates**

Run: `npm test -- --run`, `npm run lint`, `npm run build`, and `git diff --check`.
