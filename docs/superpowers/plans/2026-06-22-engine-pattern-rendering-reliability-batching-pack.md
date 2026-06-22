# Engine Pattern Rendering Reliability Batching Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve render backend reliability and batching visibility with backend contracts, worker ownership diagnostics, atlas batching analysis, and Pixi lifecycle audits.

**Architecture:** Add four renderer-side pure analysis modules that sit beside existing fallback matrix, worker bridge, Pixi batch adapter, and static batch compiler. These modules do not replace renderers; they make renderer choices, worker routing, draw-call breaks, and texture lifecycle risks explicit and testable.

**Tech Stack:** JavaScript ESM, Vitest, OmniCore renderer modules.

---

### Task 1: Contract Tests

**Files:**
- Create: `tests/engine-pattern-rendering-reliability-batching-pack.test.js`

- [x] **Step 1: Write failing tests**

The test imports `RendererBackendContract`, `RenderWorkerOwnership`, `BatchAtlasDiagnostics`, and `PixiLifecycleAudit` from `../src/index.js`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engine-pattern-rendering-reliability-batching-pack.test.js`
Expected: FAIL because the new exports are missing.

### Task 2: Backend And Worker Reliability

**Files:**
- Create: `src/renderer/RendererBackendContract.js`
- Create: `src/renderer/RenderWorkerOwnership.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement renderer backend contract resolution with explicit rejection reasons**
- [x] **Step 2: Implement worker ownership diagnostics for OffscreenCanvas and command transfer safety**

### Task 3: Batching And Lifecycle Diagnostics

**Files:**
- Create: `src/renderer/BatchAtlasDiagnostics.js`
- Create: `src/renderer/PixiLifecycleAudit.js`
- Modify: `src/index.js`

- [x] **Step 1: Implement draw-call, material, and atlas grouping diagnostics**
- [x] **Step 2: Implement Pixi init/texture/destroy lifecycle audit report**

- [x] **Step 3: Extend batching diagnostics into editor-ready frame budget reports**

Adds frame time, texture upload, filter pass, backend fallback, issue severity, and editor panel routing summaries inspired by PixiJS, Unity Frame Debugger, Unreal GPU Visualizer, and Godot RenderingServer profiler workflows.

### Task 4: Verification

**Files:**
- All modified files

- [x] **Step 1: Run focused tests**

Run: `npm test -- tests/engine-pattern-rendering-reliability-batching-pack.test.js`

- [x] **Step 2: Run related renderer tests**

Run: `npm test -- tests/engine-pattern-rendering-reliability-batching-pack.test.js tests/renderer-backends-mvp.test.js tests/pixi-framework-layer.test.js tests/lifecycle-leak-guards.test.js tests/engine-pattern-extreme-runtime-control-pack.test.js`

- [x] **Step 3: Update API contract and docs**

Run: `node scripts/contract/snapshot-api-contract.js --update`
Run: `npm test -- tests/contract/api-contract-snapshot.test.js`
Run: `npm run docs:generate`

- [x] **Step 4: Run audit, lint, build, and full tests**

Run: `npm run audit:api`
Run: `npm run lint`
Run: `npm run build`
Run: `npm test`
