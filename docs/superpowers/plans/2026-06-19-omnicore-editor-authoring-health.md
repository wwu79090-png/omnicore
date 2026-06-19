# OmniCore Editor Authoring Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an editor-side authoring health check and deterministic export bundle so artists and designers can validate industrial editor content before committing it.

**Architecture:** Keep the feature inside `packages/omnicore-editor/src/editor-app.js` and `packages/omnicore-editor/src/live-sync-protocol.js`. The editor API exposes `validateAuthoringAssets()`, `exportAuthoringBundle()`, and `getProfilerHotspots()`, and the DOM renders a lightweight health report panel from normalized editor state.

**Tech Stack:** JavaScript, DOM editor UI, Vitest/jsdom, existing editor state normalizers.

---

### Task 1: Authoring Health Report

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `packages/omnicore-editor/src/live-sync-protocol.js`
- Test: `tests/editor-authoring-health.test.js`

- [ ] **Step 1: Write the failing test**

```js
const report = app.validateAuthoringAssets();
expect(report.ok).toBe(false);
expect(report.issues).toEqual(expect.arrayContaining([
  expect.objectContaining({ code: 'particle-lifetime-invalid' }),
  expect.objectContaining({ code: 'sprite-normal-map-missing' }),
  expect.objectContaining({ code: 'animation-event-out-of-range' })
]));
expect(root.querySelector('[data-authoring-health]')?.textContent).toContain('particle-lifetime-invalid');
```

- [ ] **Step 2: Run test to verify RED**

Run: `npx vitest run tests/editor-authoring-health.test.js`
Expected: FAIL with `validateAuthoringAssets is not a function`.

- [ ] **Step 3: Implement minimal health validation**

Add `authoringHealth` to `createEditorState()`, preserve it in `editor-app.update()`, implement `validateAuthoringAssets()` in `editor-app.js`, and render `data-authoring-health` in transient surfaces.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npx vitest run tests/editor-authoring-health.test.js`
Expected: PASS.

### Task 2: Deterministic Authoring Bundle

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/editor-authoring-health.test.js`

- [ ] **Step 1: Write failing bundle test**

```js
const bundle = app.exportAuthoringBundle({ generatedAt: 'fixed' });
expect(bundle.fileName).toBe('omnicore_authoring_bundle.json');
expect(bundle.files.map((file) => file.path)).toEqual([
  'animations/jump.animation.json',
  'particles/particle_config.json',
  'sprites/panel.sprite.json',
  'scenes/town.scene.json'
]);
```

- [ ] **Step 2: Implement deterministic exporter**

Create `exportAuthoringBundle(options = {})` that sorts file entries, includes a manifest with counts, includes the latest health report, and does not add runtime dependencies.

- [ ] **Step 3: Run focused test**

Run: `npx vitest run tests/editor-authoring-health.test.js tests/editor-industrial-authoring.test.js`
Expected: PASS.

### Task 3: Profiler Hotspot Recommendations

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/editor-authoring-health.test.js`

- [ ] **Step 1: Write failing hotspot test**

```js
const hotspots = app.getProfilerHotspots({ warningMs: 8, criticalMs: 16 });
expect(hotspots[0]).toMatchObject({
  name: 'Collision',
  duration: 18,
  severity: 'critical'
});
expect(hotspots[0].suggestion).toContain('Collision');
```

- [ ] **Step 2: Implement sorted hotspot analysis**

Add `getProfilerHotspots(options = {})`, use current profiler frame sections, sort by duration descending, and attach actionable suggestions per subsystem name.

- [ ] **Step 3: Surface hotspots in the health panel**

Render hotspot rows under `data-authoring-health-hotspot` when the health report includes profiler warnings.

- [ ] **Step 4: Verify editor suite**

Run: `npx vitest run tests/editor-authoring-health.test.js tests/editor-industrial-authoring.test.js tests/editor-industrial-polish.test.js`
Expected: PASS.

### Task 4: Full Verification

**Files:**
- No additional source edits unless verification finds a real failure.

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 2: Full tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Build and production gate**

Run: `npm run build`
Run: `npm run quality:gate`
Expected: both exit 0.
