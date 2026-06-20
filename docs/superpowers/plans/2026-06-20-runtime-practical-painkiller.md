# Runtime Practical Painkiller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate five production pain points: browser image cache/predecode, China npm install guidance, audio peak limiting, runtime memory snapshots, and visual diff heatmaps.

**Architecture:** Keep the runtime dependency-free and browser-native. Extend Loader with optional Cache API and idle image decode helpers, insert a DynamicsCompressor into the existing Web Audio graph, add a small Profiler snapshot module that can inspect live scenes, and upgrade the visual regression script to generate deterministic heatmap artifacts.

**Tech Stack:** ESM JavaScript, Vitest, Web Audio API, Browser Cache API, requestIdleCallback, Node fs/path scripts.

---

### Task 1: Browser Asset Cache And Texture Predecode

**Files:**
- Modify: `src/loader/Loader.js`
- Test: `tests/runtime-painkiller.test.js`

- [x] Write failing tests for Cache API writes and idle image predecode.
- [x] Implement `cacheAssets()` and `predecodeTextures()` without adding dependencies.
- [x] Verify tests pass.

### Task 2: China NPM Registry Guidance

**Files:**
- Modify: `package.json`
- Create: `scripts/pre-install-check.js`
- Modify: `README.md`
- Test: `tests/runtime-painkiller.test.js`

- [x] Write failing tests for registry timeout guidance.
- [x] Add `preinstall` script and explicit mirror command docs.
- [x] Verify tests pass.

### Task 3: Audio Compressor And Limiter

**Files:**
- Modify: `src/audio/AudioManager.js`
- Test: `tests/runtime-painkiller.test.js`

- [x] Write failing test proving AudioManager connects through DynamicsCompressor.
- [x] Add compressor/limiter chain with safe defaults.
- [x] Verify tests pass.

### Task 4: Runtime Memory Snapshot Profiler

**Files:**
- Create: `src/debug/ProfilerSnapshot.js`
- Modify: `src/index.js`
- Modify: `src/core/OmniCore.js`
- Test: `tests/runtime-painkiller.test.js`

- [x] Write failing tests for sorted entity/component memory snapshots and F2 debug trigger.
- [x] Implement snapshot estimation and debug key binding.
- [x] Export API as `ProfilerSnapshot`.

### Task 5: Visual Diff Heatmap

**Files:**
- Modify: `scripts/visual-regression.js`
- Test: `tests/runtime-painkiller.test.js`

- [x] Write failing test for heatmap JSON artifact and CI report attachment metadata.
- [x] Generate deterministic SVG heatmaps from provided pixel-diff inputs.
- [x] Verify script exits non-zero on failed visual diffs and records heatmap paths.

### Task 6: Full Verification

**Commands:**
- [x] `npx vitest run tests/runtime-painkiller.test.js`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run quality:gate`
