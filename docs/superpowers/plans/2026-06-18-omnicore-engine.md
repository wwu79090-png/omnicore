# OmniCore Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight OmniCore HTML5 game engine package that exposes the requested Core, Renderer, Loop, SceneManager, Store, Loader, API classes, platform adapters, docs, examples, and tests.

**Architecture:** The engine is a small ESM library. `Game` composes Core, Store, Loader, Renderer, Loop, SceneManager, BackendManager, and optional Dimension3D; each module owns its lifecycle and communicates through explicit APIs. 2D Pixi/Canvas/WebGL rendering, 3D rendering, event sheets, UI, audio, storage, and network are isolated to avoid monolithic Phaser/Cocos-style coupling.

**Tech Stack:** JavaScript ESM, PixiJS v8, pixi-filters, Nano Stores, Three.js decorative background rendering, Vite, Vitest, ESLint Airbnb, Prettier.

---

### Task 1: Configuration, Research, and Tests

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `.eslintrc.json`
- Create: `.prettierrc`
- Create: `docs/research-memo.md`
- Create: `tests/omnicore.test.js`

- [x] **Step 1: Write failing tests**

Write Vitest tests that import `src/index.js` and assert Game init, SceneManager stack behavior, Tween yoyo/repeat, Store backend injection, Loader retry, EventSheet execution, Prefab component mounting, Button hit/click behavior, Easing count, ObjectPool reuse, and Backend switch lifecycle.

- [ ] **Step 2: Run red test**

Run: `npm test`

Expected: FAIL because `src/index.js` and engine modules do not exist yet.

### Task 2: Core Composition

**Files:**
- Create: `src/core/OmniCore.js`
- Create: `src/core/Bootstrap.js`
- Create: `src/core/EventBus.js`
- Create: `src/core/Timer.js`
- Create: `src/core/Logger.js`
- Create: `src/index.js`

- [ ] **Step 1: Implement EventBus, Logger, Timer, Bootstrap, and Game composition**
- [ ] **Step 2: Export `OmniCore.Game`, `Scene`, `Sprite`, `Tween`, `UI`, `Prefab`, `Backend`, and utilities from `src/index.js`**
- [ ] **Step 3: Run targeted tests**

Run: `npm test -- tests/omnicore.test.js`

Expected: Remaining failures identify missing modules beyond Core.

### Task 3: Rendering, Loop, Scene, Store, Loader

**Files:**
- Create: `src/renderer/PixiRenderer.js`
- Create: `src/renderer/Filters.js`
- Create: `src/loop/Loop.js`
- Create: `src/scene/SceneManager.js`
- Create: `src/scene/Scene.js`
- Create: `src/store/Store.js`
- Create: `src/loader/Loader.js`

- [ ] **Step 1: Implement PixiRenderer with Pixi v8 init/destroy and Canvas fallback**
- [ ] **Step 2: Implement Loop with rAF, 60 FPS lock, interpolation, pause/resume**
- [ ] **Step 3: Implement SceneManager push/pop/fade transitions and automatic destroy on pop**
- [ ] **Step 4: Implement Store using Nano Stores and backend reinjection**
- [ ] **Step 5: Implement Loader manifest preflight, 5 second timeout, retry, and friendly error hooks**
- [ ] **Step 6: Run targeted tests**

Run: `npm test -- tests/omnicore.test.js`

Expected: Rendering/loop/scene/store/loader tests pass.

### Task 4: API Classes and Utility Modules

**Files:**
- Create: `src/math/Vec2.js`
- Create: `src/math/Rect.js`
- Create: `src/math/Easing.js`
- Create: `src/audio/AudioManager.js`
- Create: `src/data/DataTable.js`
- Create: `src/data/I18n.js`
- Create: `src/data/EventSheet.js`
- Create: `src/net/NetManager.js`
- Create: `src/debug/Inspector.js`
- Create: `src/pool/ObjectPool.js`
- Create: `src/compliance/AuthManager.js`
- Create: `src/prefab/PrefabManager.js`
- Create: `src/ui/UIElement.js`
- Create: `src/ui/Button.js`

- [ ] **Step 1: Implement Vec2, Rect, and 20+ Easing functions**
- [ ] **Step 2: Implement native Canvas UI elements and zIndex sorting**
- [ ] **Step 3: Implement AudioManager, DataTable CSV parser, I18n, ObjectPool, Storage/Net wrappers, Auth hook, EventSheet parser, and Prefab instantiate**
- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: Utility and API tests pass.

### Task 5: Platforms, Examples, CLI, and Docs

**Files:**
- Create: `src/platform/PlatformAdapter.js`
- Create: `src/dimension3d/Dimension3D.js`
- Create: `scripts/create-omnicore-app.mjs`
- Create: `examples/index.html`
- Create: `examples/main.js`
- Create: `examples/asset-manifest.json`
- Create: `README.md`

- [ ] **Step 1: Implement `platform: web|electron|wechat`, Electron main/preload generation, and wx adapter**
- [ ] **Step 2: Implement independent `OmniCore.Dimension3D` layer using lazy Three.js imports for one decorative glTF/GLB background**
- [ ] **Step 3: Implement create-omnicore-app templates**
- [ ] **Step 4: Write README with Mermaid class diagram, directory tree, experimental Backend.switch warning, and usage examples**
- [ ] **Step 5: Run verification**

Run: `npm test`, `npm run build`

Expected: Tests and Vite library build pass.
