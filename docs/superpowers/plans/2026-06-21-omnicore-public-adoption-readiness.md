# OmniCore Public Adoption Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the remaining public adoption gaps into runnable templates, visible docs, browser-facing support tools, and platform readiness checks.

**Architecture:** Keep all work in existing OmniCore surfaces: static website pages, examples, docs, scripts, and focused tests. Avoid new dependencies and treat NPM/Vercel as readiness checks until credentials are confirmed.

**Tech Stack:** Node.js ESM scripts, Vitest, static HTML/CSS/JS, existing OmniCore runtime APIs.

---

### Task 1: Public Adoption Red Test

**Files:**
- Create: `tests/public-adoption-readiness.test.js`

- [ ] **Step 1: Write the failing test**
  - Assert `examples/official-templates/arcade-survivor` exists with `index.html`, `README.md`, `package.json`, and `src/main.js`.
  - Assert `website/playground/index.html` exposes `data-api-playground`, API snippets, and `downloadCrashBundle`.
  - Assert `docs/platforms/compatibility-matrix.md` and `docs/performance/real-device-capture-guide.md` exist and contain the supported platforms.
  - Assert `scripts/release-platform-check.js` exports `createReleasePlatformReadinessReport`.

- [ ] **Step 2: Run red test**
  - Run `npx vitest run tests/public-adoption-readiness.test.js --reporter=default`.
  - Expected: fail because files and script are not implemented yet.

### Task 2: Implement Public Adoption Surface

**Files:**
- Create: `examples/official-templates/arcade-survivor/*`
- Create: `docs/platforms/compatibility-matrix.md`
- Create: `docs/performance/real-device-capture-guide.md`
- Create: `scripts/release-platform-check.js`
- Modify: `website/playground/index.html`
- Modify: `website/index.html`
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Add the official arcade survivor template**
  - Add a runnable, no-dependency browser example using `OmniCore.Game`, `Scene`, `Sprite`, `Tween`, keyboard input, enemy movement, collision checks, score, and restart.

- [ ] **Step 2: Add API Playground and crash export UI**
  - Extend `website/playground/index.html` with API snippet buttons and a `downloadCrashBundle()` function that exports runtime, current code, preview srcdoc, and reproduction guidance.

- [ ] **Step 3: Add compatibility and real-device evidence docs**
  - Document Chrome, Edge, Firefox, Safari, iOS Safari, Android WebView, WeChat WebView, and file:// behavior.
  - Document 144Hz, Android 120Hz, iOS Safari, WebGPU, and WeChat capture procedures.

- [ ] **Step 4: Add platform readiness check script**
  - Export `createReleasePlatformReadinessReport`.
  - CLI writes `docs/release-notes/platform-readiness-report.json`.
  - Default mode reports blockers without failing; `--strict` exits non-zero.

### Task 3: Verification, Commit, Push, Release

**Files:**
- All files touched above.

- [ ] **Step 1: Run focused verification**
  - `npx vitest run tests/public-adoption-readiness.test.js --reporter=default`
  - `npm run release:platform-check`

- [ ] **Step 2: Run broad verification**
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run publish:dry-run`

- [ ] **Step 3: Commit and push**
  - Commit: `feat: add public adoption readiness layer`
  - Push to `codex/contract-benchmark-ci`.
  - Create GitHub release with generated readiness artifacts.
