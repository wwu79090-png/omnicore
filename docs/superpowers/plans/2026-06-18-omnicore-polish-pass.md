# OmniCore Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OmniCore look more cohesive by tightening API style, JSDoc, error messages, launcher behavior, defaults, and asset conventions.

**Architecture:** Add small shared modules instead of ad hoc edits: `src/config/defaults.js` for runtime defaults, `src/core/OmniError.js` for localized error text, and scripts for API style/docs/assets checks. Preserve existing public API names unless a check exposes a clear inconsistency; document changes in `docs/release-notes/api-style-polish.md`.

**Tech Stack:** JavaScript ESM, Vitest, ESLint, Node.js scripts.

---

### Task 1: Quality Gates

**Files:**
- Create: `tests/polish-pass.test.js`
- Create: `scripts/docs.js`
- Create: `scripts/audit-api-style.js`
- Create: `scripts/audit-asset-conventions.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing tests for docs, style, errors, launchers, defaults, and assets.**
- [ ] **Step 2: Run `npm test -- tests/polish-pass.test.js` and verify failure.**
- [ ] **Step 3: Implement scripts and package entries.**
- [ ] **Step 4: Run `npm test -- tests/polish-pass.test.js` and verify pass.**

### Task 2: Defaults and Error Formatting

**Files:**
- Create: `src/config/defaults.js`
- Create: `src/core/OmniError.js`
- Modify: `src/core/Bootstrap.js`
- Modify: `src/core/Logger.js`
- Modify: selected loader/renderer/kernel modules that throw user-facing errors.

- [ ] **Step 1: Add tests that inspect default usage and formatted error/warn output.**
- [ ] **Step 2: Run targeted tests and verify failure.**
- [ ] **Step 3: Centralize defaults and use OmniCore error helpers in core paths.**
- [ ] **Step 4: Run targeted tests and verify pass.**

### Task 3: JSDoc Core API Completion

**Files:**
- Modify: `src/core/Bootstrap.js`
- Modify: `src/core/EventBus.js`
- Modify: `src/store/Store.js`
- Modify: `src/microkernel/RendererAdapter.js`
- Modify: `src/microkernel/Kernel.js`

- [ ] **Step 1: Add docs script that fails on public methods missing `@param`/`@returns` or emitting `unknown`.**
- [ ] **Step 2: Run `npm run docs` and verify failure.**
- [ ] **Step 3: Add missing JSDoc type annotations.**
- [ ] **Step 4: Run `npm run docs` and verify pass.**

### Task 4: Launchers and Assets

**Files:**
- Modify: `launcher.js`
- Modify: `OmniCore_Dev_Launcher.bat`
- Modify: `OmniCore_Dev_Launcher.command`
- Modify: `scripts/audit-assets.js`
- Move or update references for assets that should live under `assets/sprites`, `assets/audio`, or `assets/fonts`.

- [ ] **Step 1: Add launcher and asset convention tests.**
- [ ] **Step 2: Run targeted tests and verify failure.**
- [ ] **Step 3: Normalize launcher delegation and asset path conventions.**
- [ ] **Step 4: Run targeted tests and verify pass.**

### Final Verification

- [ ] Run `npm test`
- [ ] Run `npm run lint`
- [ ] Run `npm run docs`
- [ ] Run `npm run audit:api`
- [ ] Run `npm run audit:asset-conventions`
- [ ] Run `npm run build`
- [ ] Run `npm run health`
