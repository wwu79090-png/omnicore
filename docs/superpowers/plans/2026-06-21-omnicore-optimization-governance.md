# OmniCore Optimization Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a proof-oriented optimization governance layer for OmniCore covering device baselines, runtime dashboards, asset waterfalls, size budgets, regression gates, allocation pressure, batching diagnostics, startup profiling, doctor repair commands, and template benchmarks.

**Architecture:** Keep changes additive and deterministic. CLI scripts produce JSON/Markdown evidence without requiring live browser hardware in CI; runtime helpers expose compact data models that the editor/debug UI can render later. Official templates receive small benchmark scripts that share the same report shape.

**Tech Stack:** JavaScript ESM, Vitest, existing Node.js scripts, OmniCore debug/performance/renderer modules, static Markdown documentation.

---

### Task 1: Acceptance Tests

**Files:**
- Create: `tests/optimization-governance-suite.test.js`

- [x] Write failing tests for device baseline report, runtime dashboard snapshots, resource waterfall, size audit, regression gate, allocation pressure, batching diagnostics, startup profiler, doctor fix commands, and template benchmark scripts.
- [x] Run focused test and confirm it fails for missing files/functions.

### Task 2: CLI Optimization Evidence

**Files:**
- Create: `scripts/device-performance-baseline.js`
- Create: `scripts/size-audit.js`
- Create: `scripts/performance-regression-gate.js`
- Modify: `package.json`
- Create: `docs/optimization-governance.md`

- [x] Add deterministic reports for Windows low-end GPU, Android mid-range, WeChat DevTools, and Chrome WebGPU.
- [x] Add `npm run size:audit` with runtime/editor/examples/docs/assets buckets and redline checks.
- [x] Add `npm run performance:regression` that compares baseline/current JSON and fails when configured thresholds are exceeded.

### Task 3: Runtime Observability Helpers

**Files:**
- Create: `src/debug/PerformanceDashboard.js`
- Create: `src/debug/ResourceWaterfall.js`
- Create: `src/debug/AllocationPressureReport.js`
- Create: `src/performance/StartupProfiler.js`
- Modify: `src/index.js`

- [x] Add segmented runtime dashboard snapshots for render/script/physics/assets/audio/gc.
- [x] Add resource waterfall event collection with load/decode/cache/fallback timing.
- [x] Add allocation/object-pool pressure reports.
- [x] Add startup profiler phases from `new Game()` to first frame.

### Task 4: Rendering Diagnostics And Doctor Fixes

**Files:**
- Create: `src/renderer/BatchDiagnostics.js`
- Modify: `scripts/engine-doctor.js`
- Modify: `src/index.js`

- [x] Add batching break reason diagnostics for texture, blend mode, shader, mask, material, and render layer.
- [x] Add copy-ready Chinese fix commands to doctor diagnostics.

### Task 5: Template Benchmarks

**Files:**
- Create: `examples/official-templates/platformer/benchmark.js`
- Create: `examples/official-templates/rpg-dialogue/benchmark.js`
- Create: `examples/official-templates/bullet-heaven/benchmark.js`
- Modify: each official template `package.json`

- [x] Add deterministic benchmark scripts with `fps`, `p95FrameMs`, `memoryMb`, `drawCalls`, `gcEvents`, and `packageBytes`.

### Task 6: Verification And Release

**Files:**
- All changed files.

- [x] Run focused optimization tests.
- [x] Run lint.
- [x] Run full test suite.
- [x] Run build and key smoke commands.
- [ ] Commit, push, and refresh GitHub Release.
