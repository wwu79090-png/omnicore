# OmniCore Release Credibility Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the public-release gaps that make OmniCore look unfinished despite the current engine hardening work.

**Architecture:** Keep runtime behavior unchanged and focus this pass on package entrypoints, public documentation truthfulness, release checks, and verifiable evidence artifacts. Credentials-gated publishing remains explicit: local automation may verify readiness, but npm/Vercel/GitHub Release publication must stop when required tokens are missing.

**Tech Stack:** JavaScript ESM, npm scripts, GitHub CLI, Vite build output, existing Vitest/Playwright/release gate scripts.

---

### Task 1: Public README And Website Truthfulness

**Files:**
- Modify: `README.md`
- Modify: `website/index.html`
- Modify: `website/promo/30s-demo.html`
- Modify: `docs/promotion/video-30s-script.md`

- [x] Update README badges and prose to match current verified outputs: 800+ checks, `dist/omnicore.esm.js` at 928.55 kB, and npm package not yet publicly published.
- [x] Replace the incorrect `https://omnicore.vercel.app/` default demo link with repository-local demo paths and label Vercel as pending until a valid deployment URL is available.
- [x] Keep the online demo placeholders discoverable without claiming a deployment that is not currently the engine homepage.
- [x] Update website and promotional copy that still says 590 tests.

### Task 2: NPM Package Consumer Entrypoints

**Files:**
- Modify: `package.json`
- Modify: `scripts/npm-publish-dry-run.js`
- Test: `tests/package-exports.test.js`

- [x] Point the default package export to `dist/omnicore.esm.js` while keeping explicit source subpaths for advanced source consumers.
- [x] Trim the npm `files` list so the public package is a runtime package, not a full repository archive.
- [x] Add or update tests that assert package exports and files remain aligned with public publishing goals.
- [x] Run `npm run publish:dry-run` and confirm the tarball still includes `dist/omnicore.esm.js`, declarations, README, LICENSE, and required runtime source subpaths.

### Task 3: Release State Gate

**Files:**
- Create: `scripts/release-readiness.js`
- Modify: `package.json`
- Modify: `.github/workflows/release.yml`
- Create/Update: `docs/release-notes/release-readiness-report.json`

- [x] Add a local readiness script that checks build artifacts, README stale metrics, package entrypoints, npm registry visibility, GitHub Pages status, Vercel URL sanity, and required secrets presence.
- [x] Make the release workflow run this readiness check before npm publish.
- [x] Persist a JSON report for release review.
- [x] Treat missing npm package, missing GitHub Pages, and wrong Vercel homepage as blocking public-release gaps, but not as local build/test failures.

### Task 4: WebGPU And 2.5D Evidence Pack

**Files:**
- Modify: `docs/engine-handbook.md`
- Modify: `docs/release-notes/public-release-gap-report.md`
- Modify: `examples/market-showcase/README.md`

- [x] Document which evidence is already automated and which evidence still requires a real browser/device run.
- [x] Add a copy-paste hardware evidence checklist for WebGPU fallback, 2.5D depth sorting, and market showcase FPS recording.
- [x] Link the evidence checklist from the market showcase demo.

### Task 5: Verification, Commit, And Push

**Files:**
- All files changed in this plan.

- [x] Run `npm run build`.
- [x] Run `npm run foundation:gate`.
- [x] Run `npm run publish:dry-run`.
- [x] Run `npm run publish:audit`.
- [x] Run focused tests for package exports and release readiness.
- [x] Run the full test suite if focused checks pass.
- [x] Commit and push the completed changes.
- [x] Do not claim npm publish, Vercel deployment, GitHub Pages deployment, or a fresh GitHub Release unless the corresponding command actually succeeds.
