# Godot-Style Editor Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Godot-style scene-tree to inspector linking, entity-local signals, ergonomic position access, prefab variants, and a small desktop EditorAPI surface.

**Architecture:** Keep runtime changes in the core entity/node primitives and desktop editor changes in `packages/omnicore-editor/src/editor-app.js`. Preserve the existing Live Sync protocol and tests by extending normalized scene data instead of replacing it.

**Tech Stack:** Vitest, jsdom, plain ES modules, existing OmniCore editor DOM APIs.

---

### Task 1: Entity Ergonomics

**Files:**
- Modify: `src/core/Entity.js`
- Modify: `src/node/Node.js`
- Modify: `src/scene/Scene.js`
- Test: `tests/godot-style-editor-linking.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('creates entities with local signals and mutable position accessors', () => {
  const entity = Entity.create('Node', { id: 'hero', x: 1, y: 2 });
  const calls = [];
  entity.on('died', (payload) => calls.push(payload));
  entity.emit('died', { hp: 0 });
  entity.position.x = 10;
  entity.position.y = 20;
  expect(calls).toEqual([{ hp: 0 }]);
  expect(entity).toMatchObject({ x: 10, y: 20 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/godot-style-editor-linking.test.js`
Expected: FAIL because the new test file or behavior is missing.

- [ ] **Step 3: Write minimal implementation**

Add shared position accessors to Node/Sprite-created entities and ensure object-style Entity instances receive `on/off/emit`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/godot-style-editor-linking.test.js`
Expected: PASS.

### Task 2: Desktop Scene Tree, Inspector, Prefab Variant, and EditorAPI

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `packages/omnicore-editor/src/live-sync-protocol.js`
- Test: `tests/godot-style-editor-linking.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('binds hierarchy selection to a deep inspector and creates prefab variants', () => {
  const root = document.createElement('main');
  document.body.appendChild(root);
  const app = createEditorApp(root, { state: { scene: { entities: [...] }, prefabs: [...] } });
  root.querySelector('[data-editor-entity-id="enemy"]').click();
  expect(root.querySelector('[data-inspector-field="sprite"]').value).toBe('enemy.png');
  expect(root.querySelector('[data-inspector-components]').textContent).toContain('Health');
  const variant = app.EditorAPI.createPrefabVariant('enemy', { hp: 50 });
  expect(variant).toMatchObject({ extends: 'enemy', hp: 50 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/godot-style-editor-linking.test.js`
Expected: FAIL because the deep inspector and EditorAPI are not available.

- [ ] **Step 3: Write minimal implementation**

Preserve unknown entity fields in normalization, render scale/sprite/components in the inspector, add `createPrefabVariant`, and expose a small `EditorAPI`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/godot-style-editor-linking.test.js`
Expected: PASS with no warnings.

### Task 3: Regression Verification

**Files:**
- Test: `tests/desktop-editor-packaging.test.js`
- Test: `tests/editor-maturity-ui.test.js`
- Test: `tests/industrialization-complete.test.js`
- Test: `tests/deep-engine-bindings.test.js`

- [ ] **Step 1: Run focused regression tests**

Run: `npm test -- tests/godot-style-editor-linking.test.js tests/desktop-editor-packaging.test.js tests/editor-maturity-ui.test.js tests/industrialization-complete.test.js tests/deep-engine-bindings.test.js`
Expected: PASS with no errors or warnings.
