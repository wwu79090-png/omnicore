# Editor Experience Performance Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve OmniCore editor usability and runtime/package governance without new dependencies or architecture rewrites.

**Architecture:** Keep changes inside the existing desktop editor, runtime scripts, core utilities, and test suite. Existing editor DOM rendering remains the source of truth; performance governance is added as a small standalone scheduler plus build-time package analysis.

**Tech Stack:** JavaScript ESM, Vitest, existing DOM/jsdom tests, Node build scripts, no new dependencies.

---

### Task 0: Reproducible Generated Reports

**Files:**
- Modify: `scripts/docs.js`
- Modify: `scripts/audit-api-style.js`
- Modify: `scripts/audit-deprecated.js`
- Modify: `scripts/dependency-forensics.js`
- Modify: `src/docs/ApiDocGenerator.js`
- Test: `tests/reproducible-report-generation.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('keeps generated docs stable across repeated verification scripts', () => {
  // Run docs and audit scripts twice, then assert docs/api.md and
  // docs/release-notes/api-style-polish.md are byte-identical.
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/reproducible-report-generation.test.js`
Expected: FAIL because generated timestamps differ.

- [ ] **Step 3: Implement deterministic generatedAt**

Use `OMNICORE_GENERATED_AT`, then `SOURCE_DATE_EPOCH`, then fixed `2026-06-20T00:00:00.000Z`.

- [ ] **Step 4: Run GREEN**

Run: `npx vitest run tests/reproducible-report-generation.test.js`
Expected: PASS and no generated timestamp churn.

### Task 1: Editor Visual Unity, Onboarding, and Feedback

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/desktop-editor-packaging.test.js`

- [ ] **Step 1: Write failing editor UX tests**

```js
expect(root.querySelector('[data-editor-theme="omnicore-unified"]')).toBeTruthy();
expect(root.querySelector('[data-editor-onboarding]')?.textContent).toContain('Open Project');
expect(root.querySelector('[data-editor-feedback]')?.textContent).toContain('Saved');
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/desktop-editor-packaging.test.js`
Expected: FAIL on missing unified theme/onboarding/feedback markers.

- [ ] **Step 3: Implement editor DOM/CSS markers**

Add stable unified theme tokens on toolbar/sidebar/panels/icons, render an empty-state onboarding strip on first open, and set transient feedback for drag/save/property changes.

- [ ] **Step 4: Run GREEN**

Run: `npx vitest run tests/desktop-editor-packaging.test.js`
Expected: PASS.

### Task 2: Runtime Frame Budget Scheduler

**Files:**
- Create: `src/performance/FrameBudgetScheduler.js`
- Modify: `src/index.js`
- Test: `tests/frame-budget-scheduler.test.js`
- Docs: `docs/performance/frame-budget-governance.md`

- [ ] **Step 1: Write failing scheduler tests**

```js
const scheduler = new FrameBudgetScheduler({ frameBudgetMs: 4, lowFpsThreshold: 2 });
scheduler.enqueue(() => work.push('a'), { costMs: 3 });
scheduler.enqueue(() => work.push('b'), { costMs: 3 });
expect(scheduler.runFrame({ frameTimeMs: 20 }).executed).toBe(1);
expect(scheduler.runFrame({ frameTimeMs: 40 }).degraded).toBe(true);
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/frame-budget-scheduler.test.js`
Expected: FAIL because the scheduler does not exist.

- [ ] **Step 3: Implement minimal scheduler**

Queue tasks, stop execution before per-frame budget is exceeded, preserve remaining tasks, count consecutive low-FPS frames, and call registered degradation handlers once thresholds are crossed.

- [ ] **Step 4: Run GREEN**

Run: `npx vitest run tests/frame-budget-scheduler.test.js`
Expected: PASS.

### Task 3: WeChat 4MB Redline Details

**Files:**
- Modify: `scripts/build-wechat.js`
- Test: `tests/performance-budget.test.js`
- Docs: `docs/platforms/wechat-mini-game-publish.md`

- [ ] **Step 1: Write failing WeChat package detail test**

```js
expect(() => buildWechatPackage({ source, out, limitBytes: 4 * 1024 * 1024 }))
  .toThrow(/Largest files|Largest directories|game.js/);
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/performance-budget.test.js`
Expected: FAIL because build-wechat only reports total bytes.

- [ ] **Step 3: Implement largest file and directory summaries**

Add `largestFiles` and `largestDirectories` to `wechat-build-report.json` and include both in over-limit error messages.

- [ ] **Step 4: Run GREEN**

Run: `npx vitest run tests/performance-budget.test.js`
Expected: PASS.

### Task 4: Audio and AssetLoader Fallback Coverage

**Files:**
- Modify: `src/addons/Audio.js`
- Modify: `src/loader/Loader.js`
- Test: `tests/audio-addon-fallback.test.js`

- [ ] **Step 1: Write failing fallback coverage**

```js
await expect(addon.loadAudio('bad', '/bad.ogg', decodeFailingFetcher)).resolves.toMatchObject({ omnicorePlaceholder: 'missing-audio' });
expect(await loader.loadBundle([{ key: 'missing-audio', url: '/bad.ogg', type: 'audio' }])).toMatchObject({ 'missing-audio': { fallback: true } });
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/audio-addon-fallback.test.js`
Expected: FAIL on missing decode/AssetLoader audio fallback coverage.

- [ ] **Step 3: Implement minimum fallback path**

Keep current AudioAddon placeholder behavior, add decode failure coverage, and make Loader return a non-blocking audio placeholder for audio items after retries fail.

- [ ] **Step 4: Run GREEN**

Run: `npx vitest run tests/audio-addon-fallback.test.js`
Expected: PASS.

### Task 5: Full Verification and Publish

**Files:**
- All changed files from Tasks 0-4.

- [ ] **Step 1: Run targeted tests**

Run:
`npx vitest run tests/reproducible-report-generation.test.js tests/desktop-editor-packaging.test.js tests/frame-budget-scheduler.test.js tests/performance-budget.test.js tests/audio-addon-fallback.test.js`
Expected: PASS.

- [ ] **Step 2: Run full tests and build**

Run:
`npm run test`
`npm run build`
Expected: PASS, `dist/omnicore.esm.js` exists.

- [ ] **Step 3: Commit and push**

Run:
`git add -A`
`git commit -m "feat: improve editor experience and runtime governance"`
`git push -u origin codex/contract-benchmark-ci`
Expected: branch pushed without force.
