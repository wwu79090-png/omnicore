# OmniCore Release Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build six GitHub Actions and Node.js automation mechanisms for stable npm releases, benchmark regression gates, dependency security monitoring, deprecated API scanning, crash telemetry, and documentation sync.

**Architecture:** Keep orchestration in `.github/workflows`, policy decisions in small Node.js scripts under `scripts/`, and runtime crash reporting in `src/debug/CrashReporter.js`. The workflows call package scripts so local and CI behavior match.

**Tech Stack:** GitHub Actions, Dependabot, npm scripts, Node.js ESM, Vitest, JSDoc-derived docs.

---

### Task 1: Automation Contract Tests

**Files:**
- Create: `tests/release-automation.test.js`
- Modify: `tests/commercial-engine-mvp.test.js`

- [ ] **Step 1: Add tests covering workflow triggers, scripts, Dependabot policy, docs sync, deprecated API README output, and CrashReporter telemetry defaults.**
- [ ] **Step 2: Run `npm test -- tests/release-automation.test.js tests/commercial-engine-mvp.test.js` and verify failures for missing automation details.**

### Task 2: Workflows And Package Scripts

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/benchmark.yml`
- Create: `.github/workflows/dependabot-automerge.yml`
- Create: `.github/workflows/docs-sync.yml`
- Create: `.github/dependabot.yml`
- Modify: `package.json`

- [ ] **Step 1: Configure tag-driven npm release with test, build, docs build, standard-version changelog, npm publish, and GitHub Release creation.**
- [ ] **Step 2: Configure PR benchmark gate using persisted main baseline file and artifact reports.**
- [ ] **Step 3: Add weekly Dependabot checks and guarded auto-merge workflow.**
- [ ] **Step 4: Bind `prepare` to `docs:generate` while preserving Husky installation.**

### Task 3: Node Automation Scripts

**Files:**
- Modify: `scripts/audit-deprecated.js`
- Create: `scripts/dependabot-automerge.js`
- Modify: `src/docs/ApiDocGenerator.js` if docs output compatibility is needed.

- [ ] **Step 1: Export reusable functions from the deprecated API scanner.**
- [ ] **Step 2: Scan `src/` JSDoc `@deprecated` APIs, count call sites, and update the README migration table.**
- [ ] **Step 3: Implement Dependabot auto-merge eligibility from `npm audit --json` plus PR semver metadata.**

### Task 4: Crash Telemetry Hook

**Files:**
- Modify: `src/debug/CrashReporter.js`
- Modify: `src/core/OmniCore.js` if config wiring is needed.

- [ ] **Step 1: Default CrashReporter to disabled unless config, `window.__OMNICORE_TELEMETRY__`, or environment enables it.**
- [ ] **Step 2: Include Store snapshot, current scene name, device information, memory, metrics, and operation log.**
- [ ] **Step 3: Send webhook POST with a 60 second timeout budget.**

### Task 5: Verification

**Files:**
- Modify: `tests/contract/golden/omnicore-core-api.json` only if public API shape changes.

- [ ] **Step 1: Run targeted tests.**
- [ ] **Step 2: Run `npm run lint`, `npm test`, `npm run build`, and `npm run docs:build`.**
- [ ] **Step 3: Update API contract snapshot only for intentional public API changes.**
