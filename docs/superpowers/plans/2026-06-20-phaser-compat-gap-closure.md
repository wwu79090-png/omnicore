# Phaser Compatibility Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close seven Phaser migration gaps: rich text styling, wheel/combo input, positional camera bounds, legacy-safe loader paths, data translation, web fonts, and parent-child world coordinates.

**Architecture:** Keep the work additive and backward-compatible. Add small focused runtime modules for `Text`, `Font`, and `DataAdapter`; extend existing `InputManager`, `Camera`, `Loader`, `Node`, and entity ergonomics without changing existing behavior.

**Tech Stack:** JavaScript ESM, Vitest, browser DOM APIs, existing OmniCore runtime modules.

---

### Task 1: Compatibility Tests

**Files:**
- Create: `tests/phaser-migration-compat.test.js`

- [x] **Step 1: Write failing tests**

Cover `Text#setStroke/#setShadow/#setWordWrap`, `InputManager.pointer/mouse wheel`, `keyboard.isCombo`, numeric `Camera#setBounds`, loader path maps and missing image placeholders, `DataAdapter` field translation, `Font.load`, and `Entity#getWorldPosition`.

- [x] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/phaser-migration-compat.test.js --reporter=dot`

### Task 2: Runtime APIs

**Files:**
- Create: `src/text/Text.js`
- Create: `src/assets/Font.js`
- Create: `src/data/DataAdapter.js`
- Modify: `src/input/InputManager.js`
- Modify: `src/camera/Camera.js`
- Modify: `src/loader/Loader.js`
- Modify: `src/node/Node.js`
- Modify: `src/core/Entity.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement minimal compatible APIs**

Expose the exact method names requested by the user and preserve existing public behavior.

- [x] **Step 2: Run focused tests to verify GREEN**

Run: `npm test -- tests/phaser-migration-compat.test.js --reporter=dot`

### Task 3: Verification

**Files:**
- Affected runtime modules and tests

- [x] **Step 1: Run focused and relevant regression tests**

Run compatibility, core systems, runtime hardening, advanced 2D systems, and asset loader tests.

- [x] **Step 2: Run lint and broader gate as needed**

Run `npm run lint` and a safe broader test/build command if focused checks pass.
