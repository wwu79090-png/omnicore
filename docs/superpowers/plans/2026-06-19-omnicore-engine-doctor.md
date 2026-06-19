# OmniCore Engine Doctor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class Engine Doctor that turns OmniCore's scattered quality, market, platform, and release evidence into one actionable release-readiness report.

**Architecture:** Implement a standalone `scripts/engine-doctor.js` module that imports existing scorecard builders instead of duplicating score logic. The doctor adds evidence checks that scorecards do not prove by themselves: real WeChat package bytes, generated production/security/benchmark reports, case-study proof count, and prioritized next commands. CLI entry points are `npm run doctor` and `omni doctor`.

**Tech Stack:** Node.js ESM, Vitest, existing `scripts/generate-quality-report.js` scorecard exports, existing `scripts/omni.js` CLI.

---

## File Structure

- Create `scripts/engine-doctor.js`: report builder, artifact analyzers, Markdown writer, CLI parser.
- Modify `scripts/omni.js`: route `omni doctor` to the doctor module while preserving `omni install`.
- Modify `package.json`: add `doctor` script.
- Modify `scripts/generate-quality-report.js`: include Doctor as a production trust check so future score reports notice if it disappears.
- Create `tests/engine-doctor.test.js`: TDD coverage for healthy report, missing package blockers, CLI output, and `omni doctor` routing.

## Task 1: Doctor Report Core

**Files:**
- Create: `scripts/engine-doctor.js`
- Test: `tests/engine-doctor.test.js`

- [ ] **Step 1: Write the failing healthy-report test**

```js
it('summarizes release readiness from real artifacts and market scorecards', () => {
  const root = createDoctorFixture({ includeWechatPackage: true });
  const report = createEngineDoctorReport({ projectRoot: root, generatedAt: '2026-06-19T00:00:00.000Z' });

  expect(report.ready).toBe(true);
  expect(report.score).toBe(100);
  expect(report.categories.wechatPackage).toMatchObject({ ok: true, bytes: expect.any(Number), fileCount: 3 });
  expect(report.categories.marketProof.ok).toBe(true);
  expect(report.nextActions).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- tests/engine-doctor.test.js --reporter=dot`

Expected: FAIL because `scripts/engine-doctor.js` does not exist.

- [ ] **Step 3: Implement minimal report core**

Add:

```js
export function createEngineDoctorReport({ projectRoot = root, generatedAt = new Date().toISOString() } = {}) {
  const packageSummary = readPackageSummary(projectRoot);
  const marketReadiness = buildMarketReadiness({ projectRoot, packageSummary });
  const non3DMarketScorecard = buildNon3DMarketScorecard({ projectRoot, packageSummary });
  const marketCompetitiveness = buildMarketCompetitivenessScorecard({ projectRoot, packageSummary });
  const categories = {
    releaseGates: evaluateReleaseGates(marketReadiness),
    non3DStrength: evaluateScorecard(non3DMarketScorecard, 'non-3D market scorecard'),
    marketProof: evaluateScorecard(marketCompetitiveness, 'market competitiveness'),
    wechatPackage: evaluateWechatPackage(projectRoot),
    verificationEvidence: evaluateVerificationEvidence(projectRoot)
  };
  const nextActions = buildNextActions(categories);
  const score = calculateDoctorScore(categories);
  return { generatedAt, ready: nextActions.length === 0, score, categories, nextActions };
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm test -- tests/engine-doctor.test.js --reporter=dot`

Expected: PASS for healthy report.

## Task 2: Blockers And Actions

**Files:**
- Modify: `scripts/engine-doctor.js`
- Test: `tests/engine-doctor.test.js`

- [ ] **Step 1: Write failing missing-package test**

```js
it('blocks readiness when the WeChat package is missing or empty', () => {
  const root = createDoctorFixture({ includeWechatPackage: false });
  const report = createEngineDoctorReport({ projectRoot: root });

  expect(report.ready).toBe(false);
  expect(report.categories.wechatPackage).toMatchObject({ ok: false, severity: 'error' });
  expect(report.nextActions).toContainEqual(expect.objectContaining({
    command: 'npm run build:wechat && npm run performance:budget'
  }));
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- tests/engine-doctor.test.js --reporter=dot`

Expected: FAIL because missing package action is not implemented.

- [ ] **Step 3: Implement package and evidence blockers**

Add checks:
- `dist/wechat` must contain at least one file.
- Physical bytes must be greater than zero and less than or equal to 4MB.
- `dist/wechat/wechat-build-report.json` must parse and have `pass: true`.
- `docs/release-notes/production-ready-report.json` must parse and have `ready: true`.
- `docs/security/security.md` must exist.
- `website/case-studies.html` must include at least three `data-case-study` cards.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm test -- tests/engine-doctor.test.js --reporter=dot`

Expected: PASS.

## Task 3: CLI And Scorecard Integration

**Files:**
- Modify: `scripts/engine-doctor.js`
- Modify: `scripts/omni.js`
- Modify: `package.json`
- Modify: `scripts/generate-quality-report.js`
- Test: `tests/engine-doctor.test.js`

- [ ] **Step 1: Write failing CLI tests**

```js
it('writes markdown and json from the doctor CLI', () => {
  const root = createDoctorFixture({ includeWechatPackage: true });
  execFileSync(process.execPath, [
    'scripts/engine-doctor.js',
    '--root', root,
    '--out', path.join(root, 'doctor.md'),
    '--json', path.join(root, 'doctor.json')
  ], { cwd: process.cwd(), encoding: 'utf8' });

  expect(readFileSync(path.join(root, 'doctor.md'), 'utf8')).toContain('# OmniCore Engine Doctor');
  expect(JSON.parse(readFileSync(path.join(root, 'doctor.json'), 'utf8')).ready).toBe(true);
});

it('routes omni doctor to the same report generator', () => {
  const root = createDoctorFixture({ includeWechatPackage: true });
  execFileSync(process.execPath, [
    'scripts/omni.js',
    'doctor',
    '--root', root,
    '--json', path.join(root, 'omni-doctor.json')
  ], { cwd: process.cwd(), encoding: 'utf8' });

  expect(JSON.parse(readFileSync(path.join(root, 'omni-doctor.json'), 'utf8')).ready).toBe(true);
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- tests/engine-doctor.test.js --reporter=dot`

Expected: FAIL because CLI and `omni doctor` are not wired.

- [ ] **Step 3: Implement CLI wiring**

Add:
- `npm run doctor`: `node scripts/engine-doctor.js`
- `omni doctor [--root <dir>] [--out <md>] [--json <json>]`
- quality report production trust check for `doctor` script and `scripts/engine-doctor.js`.

- [ ] **Step 4: Run focused verification**

Run: `npm test -- tests/engine-doctor.test.js tests/quality-report.test.js tests/market-competitiveness-score.test.js --reporter=dot`

Expected: PASS.

## Task 4: Full Verification

**Files:**
- No new files unless verification scripts update reports.

- [ ] **Step 1: Run lint**

Run: `npm run lint`

Expected: PASS with zero warnings/errors.

- [ ] **Step 2: Run full tests**

Run: `npm test -- --reporter=dot`

Expected: PASS.

- [ ] **Step 3: Run build and release gates**

Run:
- `npm run build`
- `npm run build:wechat`
- `npm run performance:budget`
- `npm run doctor`

Expected: all commands exit 0, Doctor reports `ready: true`.

- [ ] **Step 4: Recompute score report**

Run: `node scripts/generate-quality-report.js --out "$env:TEMP\omnicore-after-doctor-score.json"`

Expected: non-3D and market competitiveness remain above target, Doctor check is present.

## Self-Review

- Spec coverage: The plan implements a new self-diagnosis layer, CLI access, scorecard integration, tests, and verification.
- Placeholder scan: No task contains TBD/TODO/fill-later placeholders.
- Type consistency: The same exported function names are used throughout: `createEngineDoctorReport`, `writeEngineDoctorMarkdown`, and `runEngineDoctorCli`.
