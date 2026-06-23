# Editor Closure Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect visual scripting, 3D viewport inspection, prefab dependency graphing, and WebGPU pipeline diagnostics into the desktop editor as usable panels and runtime-sync payloads.

**Architecture:** Use existing `createEditorApp()` and `createEditorState()` patterns. Add editor-facing APIs that update normalized state, emit Live Sync messages, render focused panels, and export the same state through `createRuntimeSyncPayload()`.

**Tech Stack:** JavaScript ESM, Vitest, jsdom editor tests, existing OmniCore editor runtime adapters.

---

### Task 1: Visual Script Graph Panel

**Files:**
- Modify: `tests/editor-deep-toolchain.test.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `packages/omnicore-editor/src/live-sync-protocol.js`

- [ ] **Step 1: Write the failing test**

Add a Vitest case that calls `EditorAPI.openVisualScriptGraphEditor()`, `addVisualScriptNode()`, `connectVisualScriptNodes()`, `bindVisualScriptEvent()`, and `runVisualScriptGraph()`. Assert the panel renders nodes, edges, event binding, trace rows, and `editor:visual-script-graph` / `editor:visual-script-run` messages.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run .\tests\editor-deep-toolchain.test.js -t "visual script graph editor"`
Expected: FAIL because the new EditorAPI methods do not exist.

- [ ] **Step 3: Write minimal implementation**

Add normalized `visualScriptEditor` state, panel rendering, graph mutation helpers, runtime execution through `VisualScriptGraphRuntime`, Live Sync message handling, and runtime sync export.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run .\tests\editor-deep-toolchain.test.js -t "visual script graph editor"`
Expected: PASS.

### Task 2: 3D Viewport Panel

**Files:**
- Modify: `tests/editor-deep-toolchain.test.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `packages/omnicore-editor/src/live-sync-protocol.js`

- [ ] **Step 1: Write the failing test**

Add a Vitest case that calls `EditorAPI.openScene3DViewport()` with cameras, lights, materials, models, animations, and colliders. Assert the panel renders camera/light/model/material/collider rows and appears in runtime sync.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run .\tests\editor-deep-toolchain.test.js -t "3D editor viewport"`
Expected: FAIL because the new EditorAPI method does not exist.

- [ ] **Step 3: Write minimal implementation**

Add `scene3DViewport` state, panel title/icon/command, renderer markup, Live Sync message handling, and runtime sync export.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run .\tests\editor-deep-toolchain.test.js -t "3D editor viewport"`
Expected: PASS.

### Task 3: Prefab Scene Dependency Graph Panel

**Files:**
- Modify: `tests/editor-deep-toolchain.test.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `packages/omnicore-editor/src/live-sync-protocol.js`

- [ ] **Step 1: Write the failing test**

Add a Vitest case that calls `EditorAPI.refreshPrefabDependencyGraph()` with scene, prefabs, and assets. Assert nested prefab edges, scene asset references, missing asset repair actions, and panel rendering.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run .\tests\editor-deep-toolchain.test.js -t "prefab scene dependency graph"`
Expected: FAIL because the new EditorAPI method does not exist.

- [ ] **Step 3: Write minimal implementation**

Add graph builder, repair action derivation, panel rendering, Live Sync message handling, and runtime sync export.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run .\tests\editor-deep-toolchain.test.js -t "prefab scene dependency graph"`
Expected: PASS.

### Task 4: WebGPU Pipeline Diagnostics Panel

**Files:**
- Modify: `tests/editor-deep-toolchain.test.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `packages/omnicore-editor/src/live-sync-protocol.js`
- Modify: `README.md`

- [ ] **Step 1: Write the failing test**

Add a Vitest case that calls `EditorAPI.refreshWebGPUPipelinePanel()` with textures, buffers, bind groups, pipelines, fallback chain, and device-lost event. Assert lifecycle counts, fallback status, device recovery action, panel rendering, and runtime sync.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run .\tests\editor-deep-toolchain.test.js -t "WebGPU pipeline diagnostics"`
Expected: FAIL because the new EditorAPI method does not exist.

- [ ] **Step 3: Write minimal implementation**

Add normalized WebGPU pipeline diagnostics state, budget/fallback analysis, panel rendering, Live Sync message handling, runtime sync export, and README usage note.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run .\tests\editor-deep-toolchain.test.js -t "WebGPU pipeline diagnostics"`
Expected: PASS.

### Task 5: Verification and Commit

- [ ] Run targeted tests:

```bash
npx vitest run .\tests\editor-deep-toolchain.test.js
```

- [ ] Run lint:

```bash
npx eslint -c .eslintrc.json --no-eslintrc .\packages\omnicore-editor\src\editor-app.js .\packages\omnicore-editor\src\live-sync-protocol.js .\tests\editor-deep-toolchain.test.js
```

- [ ] Run full verification:

```bash
npm run lint
npm run build
npm test
git diff --check
```

- [ ] Commit and push:

```bash
git add README.md docs/superpowers/plans/2026-06-23-editor-closure-expansion.md packages/omnicore-editor/src/editor-app.js packages/omnicore-editor/src/live-sync-protocol.js tests/editor-deep-toolchain.test.js
git commit -m "feat(editor): expand visual authoring closure"
git push origin codex/contract-benchmark-ci
```
