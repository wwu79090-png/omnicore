# Editor Runtime Subpath Imports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the desktop editor build chunk pressure by importing only the runtime modules the editor actually uses through public OmniCore package subpaths.

**Architecture:** Add stable package exports for `PhysicsWorld` and `Scene3DKit`, then switch the editor from the root `omnicore` entry to those subpaths. Keep the editor/runtime decoupling rule intact: no `../src/index.js` or direct source-relative imports from editor code.

**Tech Stack:** JavaScript ESM, Vitest, npm workspaces, Vite/Rolldown build output validation.

---

### Task 1: Public Runtime Subpath Exports

**Files:**
- Modify: `package.json`
- Test: `tests/editor-runtime-subpath-imports.test.js`

- [x] **Step 1: Write the failing test**

Assert root `package.json` exports `./physics/PhysicsWorld.js` and `./dimension3d/Scene3DKit.js` to their focused runtime modules.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/editor-runtime-subpath-imports.test.js`
Expected: fail because these public subpath exports do not exist yet.

- [x] **Step 3: Add exports**

Add the two subpath exports without removing the existing root export.

### Task 2: Editor Lightweight Imports

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/editor-runtime-subpath-imports.test.js`

- [x] **Step 1: Extend the failing test**

Assert `editor-app.js` imports `PhysicsWorld` and `Scene3DKit` from the public package subpaths and no longer imports `{ PhysicsWorld, Scene3DKit } from 'omnicore'`.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/editor-runtime-subpath-imports.test.js`
Expected: fail because the editor still imports from `omnicore`.

- [x] **Step 3: Switch imports**

Update `editor-app.js` to import the two modules from `omnicore/physics/PhysicsWorld.js` and `omnicore/dimension3d/Scene3DKit.js`.

### Task 3: Build Warning Regression

**Files:**
- Test: `tests/editor-runtime-subpath-imports.test.js`

- [x] **Step 1: Extend the failing test**

Assert `npm --workspace packages/omnicore-editor run build` exits 0 and its combined output does not contain `Some chunks are larger than 500 kB`.

- [x] **Step 2: Run the test**

Run: `npm test -- tests/editor-runtime-subpath-imports.test.js`
Expected before implementation: fail with the Vite chunk warning.

- [x] **Step 3: Verify build output**

After the import switch, rerun the test and confirm the warning disappears without raising the warning threshold.

### Task 4: Verification and Commit

**Files:**
- Modify: `docs/superpowers/plans/2026-06-25-editor-runtime-subpath-imports.md`

- [x] **Step 1: Run focused checks**

Run `npm test -- tests/editor-runtime-subpath-imports.test.js tests/industrialization-decoupled.test.js tests/desktop-editor-packaging.test.js` and `npm run lint`.

- [x] **Step 2: Run build and diff checks**

Run `npm run build`, `npm --workspace packages/omnicore-editor run build`, and `git diff --check`.

- [x] **Step 3: Commit and push**

Commit as `perf(editor): use runtime subpath imports`, then push current branch.

## Self-Review

- Spec coverage: addresses the editor chunk warning root cause while keeping editor/runtime package boundaries.
- Placeholder scan: no TBD, TODO, or undefined steps remain.
- Type consistency: public subpaths are `omnicore/physics/PhysicsWorld.js` and `omnicore/dimension3d/Scene3DKit.js`.
