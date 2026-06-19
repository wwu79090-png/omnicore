# Contract Benchmark CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add golden API contract snapshots and CI benchmark regression gates so pull requests are blocked when core OmniCore APIs drift or performance regresses beyond 5%.

**Architecture:** Generate deterministic JSON contract surfaces for OmniCore.Game, Store, RendererManager, PixiRenderer, and the OmniCore.Renderer namespace, then compare them to checked-in golden files. Run the existing browser benchmark, normalize its output into baseline/current reports, compare lower-is-better and higher-is-better metrics with a 5% threshold, and publish a markdown regression report for CI annotations and PR comments.

**Tech Stack:** Node.js ESM scripts, Vitest, Playwright benchmark runner, GitHub Actions, checked-in JSON/Markdown artifacts.

---

### Task 1: Contract Snapshot Gate

**Files:**
- Create: `scripts/contract/snapshot-api-contract.js`
- Create: `scripts/contract-test.js`
- Create: `tests/contract/golden/omnicore-core-api.json`
- Create: `tests/contract/api-contract-snapshot.test.js`
- Modify: `.github/workflows/maintenance.yml`

- [ ] **Step 1: Verify RED for missing contract runner**

Run: `npm run test:contract`

Expected: FAIL because `scripts/contract-test.js` does not exist.

- [ ] **Step 2: Add a failing Vitest contract test**

Create `tests/contract/api-contract-snapshot.test.js` that imports `buildApiContract`, `loadGoldenContract`, and `diffContracts` from `scripts/contract/snapshot-api-contract.js`, then asserts that generated API shape equals `tests/contract/golden/omnicore-core-api.json`.

- [ ] **Step 3: Verify RED for missing contract helper**

Run: `npm test -- tests/contract/api-contract-snapshot.test.js`

Expected: FAIL because `scripts/contract/snapshot-api-contract.js` does not exist.

- [ ] **Step 4: Implement deterministic contract snapshot utilities**

Create `scripts/contract/snapshot-api-contract.js` with:
- `buildApiContract(OmniCore)` that records default export keys, Game prototype methods and instance keys from `new OmniCore.Game({ headless: true, autoStart: false })`, Store prototype/static methods, Renderer namespace keys, RendererManager prototype/instance keys, PixiRenderer prototype/instance keys, and RenderLayerManager prototype/instance keys.
- `loadGoldenContract(path)` that reads JSON.
- `diffContracts(actual, expected)` that returns stable path/value mismatches.
- A CLI that supports `--update` and writes `tests/contract/golden/omnicore-core-api.json`.

- [ ] **Step 5: Generate the initial golden snapshot**

Run: `node scripts/contract/snapshot-api-contract.js --update`

Expected: `tests/contract/golden/omnicore-core-api.json` is written with stable sorted keys.

- [ ] **Step 6: Implement `scripts/contract-test.js`**

Run Vitest for `tests/contract` from Node using `spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/contract'])`.

- [ ] **Step 7: Verify GREEN**

Run:
`npm test -- tests/contract/api-contract-snapshot.test.js`
`npm run test:contract`

Expected: both commands pass.

- [ ] **Step 8: Add CI contract gate**

Modify `.github/workflows/maintenance.yml` to run `npm run test:contract` after unit tests.

### Task 2: Benchmark Threshold Gate

**Files:**
- Create: `scripts/benchmark-threshold.js`
- Create: `tests/benchmark-threshold.test.js`
- Create: `tests/benchmark/fixtures/baseline.json`
- Create: `.github/workflows/benchmark.yml`

- [ ] **Step 1: Verify RED for missing benchmark CI runner**

Run: `npm run benchmark:ci`

Expected: FAIL because `scripts/benchmark-threshold.js` does not exist.

- [ ] **Step 2: Add failing threshold unit tests**

Create `tests/benchmark-threshold.test.js` that imports `compareBenchmarkResults`, `formatRegressionReport`, and `normalizeBenchmarkResult` from `scripts/benchmark-threshold.js`.

Assertions:
- A 6% increase in `summary.canvasDrawCalls` fails.
- A 5% or lower regression does not fail.
- The markdown report contains `性能下降报告`.

- [ ] **Step 3: Verify RED**

Run: `npm test -- tests/benchmark-threshold.test.js`

Expected: FAIL because `scripts/benchmark-threshold.js` does not exist.

- [ ] **Step 4: Implement benchmark threshold utilities and CLI**

Create `scripts/benchmark-threshold.js` with:
- `normalizeBenchmarkResult(result)` returning deterministic metrics.
- `compareBenchmarkResults({ baseline, current, threshold })` comparing FPS as higher-is-better and milliseconds/draw calls as lower-is-better.
- `formatRegressionReport(comparison)` returning markdown with `性能下降报告`.
- CLI options `--baseline`, `--current`, `--output`, `--threshold`, and `--update-baseline`.
- Default behavior runs `npm run benchmark`, stores current JSON in `docs/release-notes/benchmark-current.json`, compares against `tests/benchmark/fixtures/baseline.json`, writes `docs/release-notes/performance-regression-report.md`, and exits non-zero on regression.

- [ ] **Step 5: Add benchmark baseline fixture**

Create `tests/benchmark/fixtures/baseline.json` from the existing `BENCHMARK_RESULT.md` sample and include draw-call metrics.

- [ ] **Step 6: Verify GREEN for unit tests**

Run: `npm test -- tests/benchmark-threshold.test.js`

Expected: PASS.

- [ ] **Step 7: Add GitHub Actions benchmark workflow**

Create `.github/workflows/benchmark.yml` triggered on pull requests and pushes to `main`/`master`, running `npm ci`, `npx playwright install chromium`, `npm run benchmark`, `npm run benchmark:ci -- --current docs/release-notes/benchmark-current.json`, uploading JSON/Markdown artifacts, adding a step summary, and commenting the markdown report on pull requests with `actions/github-script` when the benchmark gate fails.

- [ ] **Step 8: Verify workflow and scripts**

Run:
`npm test -- tests/benchmark-threshold.test.js`
`npm run benchmark:ci -- --current tests/benchmark/fixtures/baseline.json --baseline tests/benchmark/fixtures/baseline.json --output docs/release-notes/performance-regression-report.md`

Expected: both commands pass and the report is written.

### Task 3: Final Verification

**Files:**
- All modified files.

- [ ] **Step 1: Run focused tests**

Run:
`npm test -- tests/contract/api-contract-snapshot.test.js tests/benchmark-threshold.test.js`
`npm run test:contract`

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Inspect git diff**

Run: `git diff --check` and `git status --short`

Expected: no whitespace errors and only intended files changed.
