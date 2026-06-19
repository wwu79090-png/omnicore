# OmniCore Industrial Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert OmniCore from a runtime with embedded editor surfaces into a deliverable industrial toolchain with separate runtime/editor packages, 2.5D runtime integration, automated assets, CI gates, examples, plugin marketplace, and quickstart/API docs.

**Architecture:** Keep the existing `src/` runtime as the canonical engine implementation and expose it through `packages/omnicore-runtime`; move editor UI into `packages/omnicore-editor` as an Electron/Vite desktop app that only talks to the runtime through a WebSocket Live Sync protocol. Runtime-side integration is limited to protocol/bridge adapters and 2.5D rendering modules, so the editor package has no direct imports from `src/` or `omnicore-runtime`.

**Tech Stack:** JavaScript ESM, Vitest, Vite, Electron BrowserWindow with preload, native Node WebSocket handshake, Three.js, Playwright-compatible report scripts, TypeDoc.

---

### Task 1: Decouple Runtime And Editor Packages

**Files:**
- Create: `packages/omnicore-runtime/package.json`
- Create: `packages/omnicore-runtime/src/index.js`
- Create: `packages/omnicore-editor/package.json`
- Create: `packages/omnicore-editor/index.html`
- Create: `packages/omnicore-editor/vite.config.js`
- Create: `packages/omnicore-editor/electron.main.cjs`
- Create: `packages/omnicore-editor/preload.cjs`
- Create: `packages/omnicore-editor/src/editor-app.js`
- Create: `packages/omnicore-editor/src/live-sync-client.js`
- Create: `packages/omnicore-editor/src/live-sync-server.js`
- Create: `packages/omnicore-editor/src/live-sync-protocol.js`
- Modify: `src/debug/EditorOverlay.js`
- Modify: `src/index.js`
- Test: `tests/industrialization-decoupled.test.js`

- [ ] **Step 1: Write failing tests**

Assert `packages/omnicore-runtime` and `packages/omnicore-editor` exist, editor package source has no imports from `src/` or `omnicore-runtime`, `EditorOverlay.js` contains no DOM panel implementation or imports from `src/editor`, and `createEditorApp()` renders hierarchy, inspector, scene view, tilemap, and animation timeline panels from protocol state.

- [ ] **Step 2: Run red test**

Run: `npx vitest run tests/industrialization-decoupled.test.js --testNamePattern "decoupled editor"`

Expected: FAIL because packages and independent editor modules do not exist.

- [ ] **Step 3: Implement package split**

Add runtime package re-export, standalone editor Electron/Vite app, live sync client/server/protocol modules, no-op runtime `EditorOverlay` compatibility class, and an `OmniCore.connectEditorSync()` runtime bridge.

- [ ] **Step 4: Run green test**

Run: `npx vitest run tests/industrialization-decoupled.test.js --testNamePattern "decoupled editor"`

Expected: PASS.

### Task 2: 2.5D Dimension3D Runtime

**Files:**
- Modify: `src/dimension3d/Dimension3D.js`
- Test: `tests/industrialization-decoupled.test.js`

- [ ] **Step 1: Write failing tests**

Assert `Dimension3D.Scene` can add model/light/skybox records, `worldToScreen()` and `screenToWorld()` are inverse within `0.001`, `Character3D` maps 2D sprite bounds into 3D AABB and detects overlap, and `pickModelAt()` uses raycaster intersections to highlight a model.

- [ ] **Step 2: Run red test**

Run: `npx vitest run tests/industrialization-decoupled.test.js --testNamePattern "Dimension3D"`

Expected: FAIL for missing coordinate/raycaster/Character3D APIs.

- [ ] **Step 3: Implement 2.5D APIs**

Add deterministic math helpers usable in tests and Three.js-backed paths when initialized. Keep existing decorative and scene APIs compatible.

- [ ] **Step 4: Run green test**

Run: `npx vitest run tests/industrialization-decoupled.test.js --testNamePattern "Dimension3D"`

Expected: PASS.

### Task 3: Asset Importer, Intelligent Atlas, And Platform Variants

**Files:**
- Create: `scripts/asset-importer.js`
- Modify: `scripts/pack-assets.js`
- Create: `config/platform-variants.json`
- Create: `src/assets/PlatformVariantResolver.js`
- Modify: `src/index.js`
- Modify: `package.json`
- Test: `tests/industrialization-decoupled.test.js`

- [ ] **Step 1: Write failing tests**

Create temp `source-assets/` with aseprite, psd, wav, fbx, and gltf placeholders. Run importer and assert spritesheet/audio/glb manifests, static-analysis atlas groups with draw-call reduction target `0.9`, platform variants, and runtime platform URL resolution.

- [ ] **Step 2: Run red test**

Run: `npx vitest run tests/industrialization-decoupled.test.js --testNamePattern "asset importer"`

Expected: FAIL because importer and resolver are missing.

- [ ] **Step 3: Implement importer and resolver**

Use deterministic conversion manifests without adding binary converters. Keep real converter command hooks in report fields for future CI images.

- [ ] **Step 4: Run green test**

Run: `npx vitest run tests/industrialization-decoupled.test.js --testNamePattern "asset importer"`

Expected: PASS.

### Task 4: CI Gates, Examples, Marketplace, And Docs

**Files:**
- Modify: `.github/workflows/benchmark.yml`
- Create: `scripts/test-minigame.js`
- Create: `scripts/visual-regression.js`
- Create: `tests/visual/golden/examples.json`
- Create: `examples/template-2d-platformer/*`
- Create: `examples/template-2d-rpg/*`
- Create: `examples/template-25d-showcase/*`
- Create: `website/plugins/index.html`
- Create: `docs/quickstart.md`
- Create: `typedoc.json`
- Modify: `package.json`
- Test: `tests/industrialization-decoupled.test.js`

- [ ] **Step 1: Write failing tests**

Assert benchmark workflow includes `1000 Sprite >=45 FPS`, visual regression threshold `0.005`, `npm run test:minigame`, examples, plugin marketplace references all 10 official plugins, quickstart has a two-hour path and completed code sample, and TypeDoc script/config exist.

- [ ] **Step 2: Run red test**

Run: `npx vitest run tests/industrialization-decoupled.test.js --testNamePattern "industrial gates"`

Expected: FAIL for missing scripts/docs/examples.

- [ ] **Step 3: Implement gates and docs**

Add smokeable scripts, examples, plugin page, quickstart, and TypeDoc config.

- [ ] **Step 4: Run green test**

Run: `npx vitest run tests/industrialization-decoupled.test.js --testNamePattern "industrial gates"`

Expected: PASS.

### Task 5: Verification

- [ ] **Step 1: Run focused industrial suite**

Run: `npx vitest run tests/industrialization-decoupled.test.js`

Expected: PASS.

- [ ] **Step 2: Run previous production suite**

Run: `npx vitest run tests/production-toolchain.test.js tests/dimension3d-addon.test.js tests/asset-pipeline-industrial.test.js`

Expected: PASS after updating previous overlay assertions to the decoupled editor package.

- [ ] **Step 3: Run full test and build**

Run: `npm test`

Run: `npm run build`

Expected: both exit 0.
