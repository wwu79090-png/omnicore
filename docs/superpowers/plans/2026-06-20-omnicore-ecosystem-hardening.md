# OmniCore Ecosystem Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise OmniCore's weakest non-3D area by turning ecosystem maturity into evidence-driven scoring and adding missing adoption assets.

**Architecture:** Market comparison should stop using a fixed ecosystem score and instead derive it from repo evidence: plugin packages, plugin examples, starter templates, tutorials, case studies, public benchmarks, adoption docs, and marketplace pages. The website/docs/examples additions are static assets, and the tests lock the expected evidence contract.

**Tech Stack:** Node.js ES modules, Vitest, static HTML/Markdown, existing OmniCore quality scripts.

---

### Task 1: Evidence-Driven Ecosystem Score

**Files:**
- Modify: `src/quality/MarketEngineComparison.js`
- Test: `tests/ecosystem-maturity-score.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { buildMarketEngineComparison } from '../src/quality/MarketEngineComparison.js';

describe('ecosystem maturity market scoring', () => {
  it('derives OmniCore ecosystem maturity from concrete repo evidence', () => {
    const report = buildMarketEngineComparison({ generatedAt: '2026-06-20T00:00:00.000Z' });
    const ecosystem = report.omnicore.dimensions.ecosystemMaturity;

    expect(ecosystem.score).toBeGreaterThanOrEqual(90);
    expect(ecosystem.evidence).toContain('ecosystem evidence');
    expect(ecosystem.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'pluginPackages', present: true }),
      expect.objectContaining({ key: 'starterTemplates', present: true }),
      expect.objectContaining({ key: 'tutorialLibrary', present: true }),
      expect.objectContaining({ key: 'publicBenchmarks', present: true })
    ]));
    expect(report.findings.remainingGaps.join('\n')).not.toContain('生态成熟度仍低于');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ecosystem-maturity-score.test.js --reporter=dot`
Expected: FAIL because `ecosystemMaturity.score` is still the fixed value `82` and has no `checks`.

- [ ] **Step 3: Implement minimal scoring**

Add local evidence checks to `MarketEngineComparison.js` using Node `fs/path` through `process.getBuiltinModule` when available. Replace the fixed ecosystem score with the computed evidence score.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/ecosystem-maturity-score.test.js --reporter=dot`
Expected: PASS.

### Task 2: Adoption Evidence Assets

**Files:**
- Create: `docs/ecosystem/public-benchmarks.md`
- Create: `docs/ecosystem/plugin-catalog.md`
- Create: `examples/plugins/analytics-beacon/README.md`
- Create: `examples/plugins/analytics-beacon/src/index.js`
- Modify: `website/tutorials/index.html`

- [ ] **Step 1: Write failing evidence expectations**

Extend `tests/ecosystem-maturity-score.test.js` to require public benchmark docs, a plugin catalog, and an analytics plugin example.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ecosystem-maturity-score.test.js --reporter=dot`
Expected: FAIL because the new files are missing.

- [ ] **Step 3: Add minimal evidence assets**

Create concise docs and an example plugin that demonstrate a real external adoption workflow.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/ecosystem-maturity-score.test.js --reporter=dot`
Expected: PASS.

### Task 3: Regression and Score Refresh

**Files:**
- Update generated: `docs/release-notes/market-engine-comparison.json`
- Update generated: `docs/release-notes/market-engine-comparison.md`

- [ ] **Step 1: Run focused and market tests**

Run: `npm test -- tests/ecosystem-maturity-score.test.js tests/market-competitiveness-score.test.js --reporter=dot`
Expected: PASS.

- [ ] **Step 2: Refresh market comparison**

Run: `npm run market:compare`
Expected: regenerated market comparison files.

- [ ] **Step 3: Run final gates**

Run: `npm run doctor`, `npm run performance:budget`, and at least the relevant focused tests.
Expected: no failures.
