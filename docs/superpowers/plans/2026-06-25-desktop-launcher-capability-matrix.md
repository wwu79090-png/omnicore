# Desktop Launcher Capability Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an EXE launcher capability matrix that connects every major engine area to useful command windows, editor panels, status output, and next-step guidance.

**Architecture:** Extend the existing `editor-app.js` desktop launcher constants and DOM rendering with a compact matrix panel. Reuse existing command execution and independent command-window flow instead of adding dead buttons or duplicate actions.

**Tech Stack:** JavaScript ESM, Vitest, JSDOM, existing OmniCore editor app, lucide-static icons already wired by the launcher.

---

### Task 1: Capability Matrix Contract

**Files:**
- Modify: `tests/desktop-editor-packaging.test.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`

- [x] **Step 1: Write the failing test**

Add a launcher test that expects `[data-desktop-capability-matrix]`, eight capability rows, source-engine labels, panel targets, status chips, and action buttons that open independent command windows.

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/desktop-editor-packaging.test.js`

Expected: fail because the matrix DOM does not exist yet.

- [x] **Step 3: Implement the matrix renderer**

Add capability metadata near the desktop launcher constants, render the matrix inside the launcher, and keep rows compact so the hub stays readable.

- [x] **Step 4: Bind matrix row actions**

Make each matrix action use the existing `data-desktop-command` path so it opens the same independent command window and real editor action as command cards.

- [x] **Step 5: Verify focused tests and quality checks**

Run the focused desktop launcher test, then run lint/build/docs/API contract checks that are affected by editor/public surface changes.
