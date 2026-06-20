# OmniCore Showcase Feedback Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close OmniCore's adoption gaps with a flagship playable case, repeatable positioning line, visual benchmark showroom, opt-in telemetry, and public roadmap page.

**Architecture:** Keep this pass additive and low-risk: static public pages under `website/`, runnable demo code under `examples/full-game-demo/`, benchmark presentation in `tests/benchmark/`, and opt-in telemetry behavior in the existing debug collector. A single Vitest acceptance file locks the external-facing surfaces.

**Tech Stack:** JavaScript ESM, static HTML/CSS, existing OmniCore `Game`/`Scene`/`Sprite`, Vitest, current benchmark harness.

---

### Task 1: Adoption Anchor And Positioning

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Modify: `website/index.html`
- Test: `tests/showcase-feedback-loop.test.js`

- [ ] **Step 1: Write failing tests** requiring the exact positioning line `OmniCore: 33KB WebGPU 轻量引擎，跑 1000 个 Sprite 还能稳 144 FPS。` in README, package description, and homepage.
- [ ] **Step 2: Run RED** with `npm test -- tests/showcase-feedback-loop.test.js`.
- [ ] **Step 3: Add the positioning line** as the first memorable sentence in the README, package metadata, homepage hero, and a visible flagship Code Awakener block.
- [ ] **Step 4: Run GREEN** with `npm test -- tests/showcase-feedback-loop.test.js`.

### Task 2: Playable 30-Minute Full Game Demo

**Files:**
- Create: `examples/full-game-demo/README.md`
- Create: `examples/full-game-demo/index.html`
- Create: `examples/full-game-demo/main.js`
- Modify: `examples/index.html`
- Modify: `website/index.html`
- Test: `tests/showcase-feedback-loop.test.js`

- [ ] **Step 1: Extend tests** requiring a runnable `examples/full-game-demo/` with README, HTML, JS, OmniCore imports, keyboard/click controls, score/restart logic, and homepage/example links.
- [ ] **Step 2: Run RED** with the same test command.
- [ ] **Step 3: Implement a compact playable dodge/collect game** using `OmniCore.Game`, `Scene`, `Sprite`, keyboard/touch controls, score, fail state, restart, and visible HUD.
- [ ] **Step 4: Run GREEN** with the same test command.

### Task 3: Benchmark Visual Showroom

**Files:**
- Modify: `tests/benchmark/benchmark.html`
- Modify: `tests/benchmark/benchmark.js`
- Test: `tests/showcase-feedback-loop.test.js`
- Test: `tests/benchmark-threshold.test.js`

- [ ] **Step 1: Extend tests** requiring `data-benchmark-showroom`, visible `144 FPS`, `1000 Sprite`, and `1 Draw Call` indicators while preserving `window.__OMNICORE_BENCHMARK_RESULT__`.
- [ ] **Step 2: Run RED** with `npm test -- tests/showcase-feedback-loop.test.js`.
- [ ] **Step 3: Rework the benchmark page** into a full-viewport dynamic showroom with rolling sprites and live metric indicators, keeping JSON benchmark output for CI.
- [ ] **Step 4: Run GREEN** with showcase and benchmark threshold tests.

### Task 4: Opt-In Telemetry And Roadmap Loop

**Files:**
- Modify: `src/debug/TelemetryCollector.js`
- Modify: `src/index.js`
- Modify: `website/roadmap.md`
- Create: `website/roadmap.html`
- Test: `tests/showcase-feedback-loop.test.js`
- Test: `tests/telemetry-collector.test.js`

- [ ] **Step 1: Extend tests** requiring telemetry default-off behavior, manual `anonymous: true` opt-in summary, engine version, error type counts, API usage counts, and a public roadmap board.
- [ ] **Step 2: Run RED** with focused telemetry/showcase tests.
- [ ] **Step 3: Add opt-in anonymous telemetry summary** to `TelemetryCollector` without network submission and document the public roadmap lanes.
- [ ] **Step 4: Run GREEN** with focused tests, then run lint/build/doctor before committing.
