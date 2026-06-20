# OmniCore Runtime Observability And Community Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in runtime health telemetry, weak-environment validation, contributor sandbox verification, and public News/community update surfaces.

**Architecture:** Keep runtime telemetry opt-in and anonymous by default: `OmniCore.Game({ telemetry: { enabled: true } })` creates a collector, records aggregate runtime samples, and optionally flushes to a developer-owned endpoint. Extend existing health and benchmark scripts with deterministic, testable profile helpers, then wire docs and CI to expose the new workflows without requiring credentials.

**Tech Stack:** JavaScript ES modules, Vitest, Playwright, GitHub Actions, Vercel serverless functions, static website HTML/Markdown.

---

### Task 1: Runtime Health Telemetry

**Files:**
- Modify: `src/debug/TelemetryCollector.js`
- Modify: `src/index.js`
- Create: `api/telemetry.js`
- Create: `tests/runtime-telemetry.test.js`
- Modify: `tests/telemetry-collector.test.js`
- Modify: `README.md`

- [ ] **Step 1: Write failing tests** for default-off Game telemetry, opt-in runtime samples, anonymous aggregate export, endpoint flushing, and Vercel/local receiver behavior.
- [ ] **Step 2: Run RED** with `npm test -- tests/runtime-telemetry.test.js tests/telemetry-collector.test.js`.
- [ ] **Step 3: Implement collector runtime sampling and Game opt-in wiring** without sending anything unless `telemetry.enabled === true` and an endpoint/transport is provided.
- [ ] **Step 4: Add `api/telemetry.js`** to accept POST JSON and append JSONL to `OMNICORE_TELEMETRY_FILE` or temp storage.
- [ ] **Step 5: Run GREEN** with the focused tests and check output has no warnings.

### Task 2: Multi-Environment Simulation

**Files:**
- Create: `scripts/lib/environment-profiles.js`
- Modify: `scripts/health-check.js`
- Modify: `scripts/benchmark.js`
- Modify: `package.json`
- Create: `tests/environment-simulation.test.js`

- [ ] **Step 1: Write failing tests** for 3G/4G/offline network profile metadata, health-check `--network`, `test:backends` script wiring, and 2GB memory benchmark summary.
- [ ] **Step 2: Run RED** with `npm test -- tests/environment-simulation.test.js`.
- [ ] **Step 3: Implement network profile helper and health-check network scan** using Playwright request delay/offline modes.
- [ ] **Step 4: Implement benchmark `memory-limit` task** with a deterministic low-memory device profile summary.
- [ ] **Step 5: Run GREEN** with focused tests and `npm run test:backends`.

### Task 3: Contributor Sandbox And Preview CI

**Files:**
- Create: `Dockerfile.contributor`
- Modify: `CONTRIBUTING.md`
- Create: `.github/workflows/contributor-preview.yml`
- Modify: `tests/quality-gates-hardening.test.js`

- [ ] **Step 1: Write failing static tests** that require Docker sandbox docs, `npm link` workflow, and contributor preview artifact workflow.
- [ ] **Step 2: Run RED** with `npm test -- tests/quality-gates-hardening.test.js`.
- [ ] **Step 3: Add Dockerfile and CONTRIBUTING instructions** for isolated install/test/build.
- [ ] **Step 4: Add contributor preview workflow** that runs quality commands, builds dist, and uploads reports/dist artifacts.
- [ ] **Step 5: Run GREEN** with focused tests.

### Task 4: News Surface And README Latest Dynamics

**Files:**
- Create: `website/news/index.html`
- Create: `website/news/2026-06-runtime-observability.md`
- Modify: `website/index.html`
- Modify: `README.md`
- Modify: `tests/quality-gates-hardening.test.js`

- [ ] **Step 1: Write failing tests** that require README latest release badge, News link, monthly update, release notes, and community case sections.
- [ ] **Step 2: Run RED** with `npm test -- tests/quality-gates-hardening.test.js`.
- [ ] **Step 3: Add static News page and README badge/docs copy**.
- [ ] **Step 4: Run GREEN** with focused tests.

### Task 5: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run targeted tests** for telemetry, simulation, and quality gate hardening.
- [ ] **Step 2: Run lint** with `npm run lint`.
- [ ] **Step 3: Run relevant integration gates**: `npm run test:backends`, `npm run benchmark:memory`, `npm run test:contract`, `npm run docs:typedoc`.
- [ ] **Step 4: Refresh production report if needed** with `npm run production-ready`.
