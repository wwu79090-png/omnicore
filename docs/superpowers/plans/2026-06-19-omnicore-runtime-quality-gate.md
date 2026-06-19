# OmniCore Runtime Quality Gate Implementation Plan

> **For agentic workers:** Continue this plan with TDD. Keep the scope inside runtime quality checks and avoid rewriting existing editor, marketplace, or publishing surfaces.

**Goal:** Push OmniCore engine quality beyond release checklists by adding a deterministic runtime quality gate that can be imported by tests, run from CI, and used by engine contributors before shipping risky runtime changes.

**Architecture:** Add a pure ESM quality harness under `src/quality/` with no browser or native dependencies. A small CLI in `scripts/` runs the same harness and emits a machine-readable JSON report. Public exports are added through `src/index.js`, and the package script is added as `quality:engine`.

**Quality Dimensions:**
- Determinism: run the same world factory twice with the same seed and compare stable frame hashes.
- Runtime invariants: reject duplicate entity IDs, missing IDs, non-finite transforms, invalid component collections, and negative sizes.
- Performance budgets: compare measured metrics against configured maxima and produce actionable suggestions.
- Gate report: return `ok`, `score`, `checks`, `failures`, and `suggestions` so CI can fail clearly.

---

### Task 1: Add RED Tests

**Files:**
- Create: `tests/engine-quality-harness.test.js`
- Create: `tests/engine-quality-cli.test.js`

- [ ] Write tests for deterministic pass/fail behavior.
- [ ] Write tests for entity invariant failures.
- [ ] Write tests for budget failures and suggestions.
- [ ] Write tests for CLI JSON report generation and package script registration.
- [ ] Run focused tests and confirm they fail before implementation.

### Task 2: Implement Runtime Quality Harness

**Files:**
- Create: `src/quality/EngineQualityHarness.js`

- [ ] Implement stable JSON serialization and deterministic hashing.
- [ ] Implement `runDeterminismCheck`.
- [ ] Implement `runInvariantCheck`.
- [ ] Implement `runBudgetCheck`.
- [ ] Implement `runEngineQualityGate`.

### Task 3: Add CLI And Public Entry Points

**Files:**
- Create: `scripts/engine-quality-gate.js`
- Modify: `package.json`
- Modify: `src/index.js`

- [ ] Add `npm run quality:engine`.
- [ ] Export the harness from the public package entry.
- [ ] Make CLI write an optional `--out` JSON report and exit non-zero only when the gate fails.

### Task 4: Verify

- [ ] Run `npm test -- tests/engine-quality-harness.test.js tests/engine-quality-cli.test.js`.
- [ ] Run `npm run quality:engine -- --out <temp-report>`.
- [ ] Run `git diff --check`.
