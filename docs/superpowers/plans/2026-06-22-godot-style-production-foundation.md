# Godot Style Production Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Godot-inspired production foundations to OmniCore without changing its Web 2D/2.5D positioning.

**Architecture:** Keep the features data-driven and runtime/editor agnostic. Add small modules that normalize scene resources, signals, export presets, asset import metadata, inspector schemas, tilemap authoring helpers, and plugin manifests, then export them through `src/index.js`.

**Tech Stack:** JavaScript ESM, Vitest, existing OmniCore runtime modules.

---

### Task 1: Contract Tests

**Files:**
- Create: `tests/godot-style-production-foundation.test.js`

- [x] **Step 1: Write failing tests**

```js
import {
  AssetImportMetadata,
  EditorInspectorModel,
  ExportPreset,
  PluginManifest,
  SceneDocument,
  SignalBus,
  Tilemap,
  instantiateSceneDocument
} from '../src/index.js';
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/godot-style-production-foundation.test.js`
Expected: FAIL because the new exports do not exist yet.

### Task 2: Scene Resource Model

**Files:**
- Modify: `src/scene/SceneDocument.js`
- Modify: `src/index.js`

- [x] **Step 1: Add `instantiateSceneDocument()`**

It returns a tree with stable `uid`, `resourcePath`, merged inherited scene children, and per-instance overrides.

- [x] **Step 2: Re-run the scene tests**

Run: `npm test -- tests/godot-style-production-foundation.test.js`

### Task 3: Signal System

**Files:**
- Create: `src/core/SignalBus.js`
- Modify: `src/scene/Scene.js`
- Modify: `src/index.js`

- [x] **Step 1: Add a reusable `SignalBus`**

It supports `signal(name).connect(handler)`, `connect(sourceSignal, target, targetSignalOrHandler)`, `once`, `disconnect`, and `emit`.

- [x] **Step 2: Wire ComponentHost connect/emit compatibility**

Scene and Sprite keep existing `on/off/emit` behavior and gain `connect()`.

### Task 4: Export Presets

**Files:**
- Create: `src/platform/ExportPreset.js`
- Modify: `src/index.js`

- [x] **Step 1: Normalize platform export settings**

Support Web, WeChat, and Electron defaults with icons, permissions, bundle budgets, and validation warnings.

### Task 5: Asset Import Metadata

**Files:**
- Create: `src/assets/AssetImportMetadata.js`
- Modify: `src/index.js`

- [x] **Step 1: Add stable asset UID and platform variants**

Normalize source paths, importer type, cache keys, dependencies, and reimport decisions.

### Task 6: Editor Inspector Model

**Files:**
- Create: `src/editor/EditorInspectorModel.js`
- Modify: `src/index.js`

- [x] **Step 1: Build UI-agnostic inspector schema**

Expose grouped editable fields for transform, rendering, identity, components, and custom props.

### Task 7: 2D Tilemap Authoring Helpers

**Files:**
- Create: `src/tilemap/TilemapAuthoringTools.js`
- Modify: `src/tilemap/Tilemap.js`
- Modify: `src/index.js`

- [x] **Step 1: Add brush preview and collision overlay helpers**

Generate deterministic tile edits, world-space previews, and collision polygons without mutating maps by default.

### Task 8: Plugin Manifest

**Files:**
- Create: `src/core/PluginManifest.js`
- Modify: `src/core/Plugin.js`
- Modify: `src/index.js`

- [x] **Step 1: Normalize plugin manifest metadata**

Differentiate runtime/editor plugins, permission scopes, compatible engine range, and entry points.

### Task 9: Verification

**Files:**
- All modified files

- [x] **Step 1: Run focused tests**

Run: `npm test -- tests/godot-style-production-foundation.test.js`

- [x] **Step 2: Run relevant existing tests**

Run: `npm test -- tests/omnicore.test.js tests/advanced-2d-systems.test.js tests/production-toolchain.test.js`

- [x] **Step 3: Run lint if focused tests are clean**

Run: `npm run lint`

- [x] **Step 4: Run production build**

Run: `npm run build`

- [x] **Step 5: Attempt full test suite**

Run: `npm test`
Result: later re-run after the cross-engine API golden update passed, 169 files and 821 tests.
