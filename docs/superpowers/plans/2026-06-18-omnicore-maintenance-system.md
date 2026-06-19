# OmniCore Maintenance System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sustainable maintenance system for OmniCore covering health checks, migration, deprecation audits, security updates, AI review hooks, platform docs, release notes, and CI.

**Architecture:** Maintenance automation lives under `scripts/`, migrations under `migration/`, and governance docs under `docs/security`, `docs/release-notes`, and `docs/platforms`. Runtime migration hooks are added to `OmniCore.Storage` and wired into `Game.init()` so saved data can be upgraded without overwriting original records.

**Tech Stack:** Node.js ESM scripts, npm scripts, GitHub Actions, Vitest, Playwright, npm-check-updates, local Ollama-compatible AI review endpoint.

---

### Task 1: Tests First

**Files:**
- Create: `tests/maintenance.test.js`

- [x] **Step 1: Write failing tests**

Cover Storage migration backup semantics, Game startup version mismatch callback, deprecated API forwarding, and npm maintenance script presence.

- [ ] **Step 2: Run red test**

Run: `npm test -- tests/maintenance.test.js`

Expected: FAIL because migration APIs, deprecation helpers, and package scripts are missing.

### Task 2: Runtime Migration and Deprecation APIs

**Files:**
- Modify: `src/net/NetManager.js`
- Modify: `src/core/OmniCore.js`
- Create: `src/core/Deprecation.js`
- Modify: `src/index.js`
- Create: `migration/v1.0.0_to_v2.0.0.js`

- [ ] **Step 1: Add `StorageManager.engineVersion`, `configure`, `ensureEngineVersion`, and no-overwrite backup migration**
- [ ] **Step 2: Call Storage version check from `Game.init()`**
- [ ] **Step 3: Add deprecated API helpers and compatibility forwarding**
- [ ] **Step 4: Run targeted tests**

Run: `npm test -- tests/maintenance.test.js`

Expected: PASS.

### Task 3: Maintenance Scripts and CI

**Files:**
- Create: `scripts/health-check.js`
- Create: `scripts/audit-deprecated.js`
- Create: `scripts/ai-code-scan.js`
- Create: `scripts/migration-helper.js`
- Create: `scripts/security-check.js`
- Create: `.github/workflows/maintenance.yml`
- Modify: `package.json`

- [ ] **Step 1: Implement health checks with memory, backend, and Playwright modes**
- [ ] **Step 2: Implement deprecated API static audit report**
- [ ] **Step 3: Implement local Ollama-compatible AI code scan template**
- [ ] **Step 4: Implement npm audit/ncu security check with security doc append**
- [ ] **Step 5: Add GitHub Actions scheduled/release/manual workflow**

### Task 4: Documentation and Release Records

**Files:**
- Create: `CHANGELOG.md`
- Create: `docs/security/security.md`
- Create: `docs/release-notes/v0.2.0-draft.md`
- Create: `docs/platforms/wechat_mini.md`
- Modify: `README.md`
- Modify: `examples/index.html`

- [ ] **Step 1: Document API lifecycle management and migration guide**
- [ ] **Step 2: Document security history and platform compatibility**
- [ ] **Step 3: Add feedback button linked to changelog and issue creation**
- [ ] **Step 4: Run full verification**

Run: `npm test`, `npm run build`, `npm run lint`, `node scripts/health-check.js --quick`, `node scripts/audit-deprecated.js`, `node scripts/ai-code-scan.js --dry-run`.

Expected: all commands exit 0.
