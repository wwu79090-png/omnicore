# OmniCore Evidence And Packaging Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the latest performance/API work into public proof: real-device evidence files, TypeScript coverage gates, soak evidence, WebGPU evidence, npm package audits, a demo, README/website surfaces, and a CI gate.

**Architecture:** Reuse existing scripts where available and add small evidence aggregators. Every new public capability must have a deterministic test that runs in Node without external credentials or paid services.

**Tech Stack:** JavaScript ESM, Vitest, existing npm scripts, GitHub Actions, no new dependencies.

---

### Task 1: Evidence And Quality Red Test

**Files:**
- Create: `tests/evidence-and-packaging-hardening.test.js`

- [ ] **Step 1: Write a failing test**

Cover real-device uncapped FPS evidence, TypeScript declaration coverage, soak evidence, WebGPU evidence, npm package quality audit, performance demo, README/website copy, and CI gate.

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/evidence-and-packaging-hardening.test.js --reporter=default`

Expected: FAIL because the new scripts/docs/demo/gates do not exist yet.

### Task 2: Implement Evidence Scripts And Docs

**Files:**
- Create: `scripts/capture-uncapped-fps-evidence.js`
- Create: `scripts/verify-types-coverage.js`
- Create: `scripts/performance-hot-paths-gate.js`
- Modify: `scripts/runtime-soak.js`
- Modify: `scripts/capture-webgpu-evidence.js`
- Modify: `scripts/npm-publish-dry-run.js`
- Create: `docs/performance/real-device-uncapped-fps.md`
- Create: `docs/performance/types-coverage.md`
- Create: `docs/performance/long-run-stability.md`
- Create: `docs/performance/webgpu-hot-path-evidence.md`
- Create: `docs/performance/npm-package-quality.md`

- [ ] **Step 1: Implement deterministic reports**

Each script should be callable from tests with temporary outputs and should include clear pass/fail fields.

- [ ] **Step 2: Add package scripts**

Expose scripts as `performance:uncapped-evidence`, `types:coverage`, and `performance:hot-paths-gate`.

### Task 3: Demo, README, Website, CI

**Files:**
- Create: `examples/performance-hot-paths-demo/*`
- Modify: `README.md`
- Modify: `website/index.html`
- Modify: `.github/workflows/benchmark.yml`

- [ ] **Step 1: Add a runnable demo**

The demo must show toggles and metrics for uncapped FPS, render batching, object pools, dirty sync, tile streaming, animation LOD, texture budgets, and WebGPU descriptors.

- [ ] **Step 2: Surface proof publicly**

README and website should link to the new evidence docs and demo.

- [ ] **Step 3: Add CI gate**

Benchmark workflow should run the hot-path gate and upload the generated report.

### Task 4: Verification And Release

- [ ] **Step 1: Regenerate docs and API contract**

Run: `npm run docs:generate`

Run: `node scripts/contract/snapshot-api-contract.js --update`

- [ ] **Step 2: Run verification**

Run focused tests, `npm run lint`, `npm run test`, `npm run build`, and `npm run publish:dry-run`.

- [ ] **Step 3: Commit, push, release**

Commit as `feat: add evidence and packaging hardening`, push, and create a GitHub Release.
