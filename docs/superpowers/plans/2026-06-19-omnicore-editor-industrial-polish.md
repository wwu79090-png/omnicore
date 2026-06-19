# OmniCore Editor Industrial Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the industrial editor features so particle, sprite, animation, prefab, profiler, and multi-scene work survives autosave, supports undo/redo where it changes authoring data, and exposes faster visual actions.

**Architecture:** Keep all changes inside the existing editor state/API surface. Extend `saveSnapshot()` to persist authoring-side state, add UI affordances in `editor-app.js`, and cover behavior with focused Vitest tests.

**Tech Stack:** JavaScript, DOM-based editor UI, Vitest/jsdom, existing OmniCore editor state normalizers.

---

### Task 1: Persist Industrial Authoring State

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/editor-industrial-polish.test.js`

- [ ] **Step 1: Write failing snapshot test**

```js
const snapshot = app.saveSnapshot('industrial-polish');
expect(snapshot.animations.jump.events[0]).toMatchObject({ name: 'land' });
expect(snapshot.particleEditor.config.emissionRate).toBe(96);
expect(snapshot.spriteEditor.nineSlice.left).toBe(6);
expect(snapshot.sceneTabs[0].path).toBe('scenes/town.json');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/editor-industrial-polish.test.js`
Expected: FAIL because snapshot omits new authoring fields.

- [ ] **Step 3: Extend `saveSnapshot()`**

Add cloned `animations`, `selectedAnimationKeyframe`, `particleEditor`, `spriteEditor`, `profilerFrame`, `profilerHistory`, `sceneTabs`, and `activeSceneTabPath`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/editor-industrial-polish.test.js`
Expected: PASS.

### Task 2: Undo/Redo For Visual Authoring Edits

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/editor-industrial-polish.test.js`

- [ ] **Step 1: Write failing undo/redo test**

```js
app.openParticleEditor();
app.setParticleParameter('emissionRate', 120);
app.undo();
expect(app.getState().particleEditor.config.emissionRate).toBe(30);
app.redo();
expect(app.getState().particleEditor.config.emissionRate).toBe(120);
```

- [ ] **Step 2: Add history commits to data-changing visual editors**

Call `pushHistory()` in `setParticleParameter`, `setParticleCurve`, `setParticleGradient`, `setNineSliceGuides`, and `autoGenerateSpriteCollider`.

- [ ] **Step 3: Run focused tests**

Run: `npx vitest run tests/editor-industrial-polish.test.js tests/editor-industrial-authoring.test.js`
Expected: PASS.

### Task 3: Add Faster Visual Actions And Profiler History

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/editor-industrial-polish.test.js`

- [ ] **Step 1: Write failing UI affordance tests**

```js
expect(root.querySelector('[data-prefab-override-action="damage:write"]')).toBeTruthy();
expect(root.querySelector('[data-profiler-history]')?.textContent).toContain('128MB');
expect(root.querySelector('[data-material-field="colorTint"]').type).toBe('color');
```

- [ ] **Step 2: Implement controls**

Add write/reset buttons per prefab override row, render profiler history stream, use `type="color"` for color tint and `type="number"` for alpha clip.

- [ ] **Step 3: Verify full editor suite**

Run: `npx vitest run tests/editor-industrial-polish.test.js tests/editor-industrial-authoring.test.js tests/editor-productivity-max.test.js tests/desktop-editor-workflow.test.js`
Expected: PASS.

### Task 4: Full Quality Verification

**Files:**
- No source edits unless verification finds a real issue.

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: PASS with 0 warnings/errors.

- [ ] **Step 2: Full tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Build and production gate**

Run: `npm run build`
Run: `npm run quality:gate`
Expected: both PASS.
