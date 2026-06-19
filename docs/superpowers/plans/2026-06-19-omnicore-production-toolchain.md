# OmniCore Production Toolchain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade OmniCore into a team-ready production toolchain with usable editor panels, animation authoring/runtime, automated asset builds, device performance reports, examples, and official addons.

**Architecture:** Extend the existing `src/`, `scripts/`, `config/`, `examples/`, and test layout without replacing the engine core. `EditorOverlay` remains the named user-facing editor entry, `AnimationEditor` stays the authoring surface, asset build automation is a Node script, and examples/addons are regular importable OmniCore packages.

**Tech Stack:** JavaScript ESM, Vitest, Playwright, PixiJS v8, `@esotericsoftware/spine-pixi`, Vite.

---

### Task 1: Editor Overlay Panels And Tilemap Editing

**Files:**
- Modify: `src/debug/EditorOverlay.js`
- Test: `tests/production-toolchain.test.js`

- [ ] **Step 1: Write failing editor overlay tests**

Add tests that create a fake game with a scene, attach `EditorOverlay`, click a `[data-overlay-entity-id="0"]` row, edit `[data-overlay-prop="x"]`, select a prefab preview, drag it to the canvas, paint a tile, draw a collision rectangle, and assert `exportTilemapJson()` returns Tiled-compatible `tilelayer` and `objectgroup` layers.

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run tests/production-toolchain.test.js --testNamePattern "production editor overlay"`

Expected: FAIL because `data-overlay-entity-id`, `data-overlay-prop`, `setTileBrush`, `paintTile`, `drawCollisionRect`, and `exportTilemapJson` are missing.

- [ ] **Step 3: Implement overlay panels**

Add left scene hierarchy, right inspector, prefab library preview with grid background, drag-to-scene instantiation, tilemap mode state, brush selection, tile painting, collision rectangle storage, `exportTilemapJson()`, and store sync keys:
`editor:sceneHierarchy`, `editor:inspectorEntity`, `editor:prefabPreview`, and `editor:tilemapJson`.

- [ ] **Step 4: Verify editor tests pass**

Run: `npx vitest run tests/production-toolchain.test.js --testNamePattern "production editor overlay"`

Expected: PASS with prefab instantiation and Tiled JSON assertions.

### Task 2: Animation Timeline, Spine Adapter, And State Machine

**Files:**
- Modify: `src/editor/AnimationEditor.js`
- Modify: `src/animation/SkeletalAnimation.js`
- Create: `src/animations/AnimationStateMachine.js`
- Modify: `src/index.js`
- Modify: `package.json`
- Test: `tests/production-toolchain.test.js`

- [ ] **Step 1: Write failing animation tests**

Add tests for easing metadata in exported `animation.json`, preview playback state, a Spine Pixi runtime adapter calling `PIXI.Assets.add/load`, `new spine.Spine({ skeleton, atlas })`, `state.setAnimation(0, 'attack', true)`, and a state machine that switches `idle -> walk -> attack` from transition predicates.

- [ ] **Step 2: Run failing animation tests**

Run: `npx vitest run tests/production-toolchain.test.js --testNamePattern "production animation"`

Expected: FAIL because easing export, `SpinePixiRuntimeAdapter`, and `AnimationStateMachine` do not exist.

- [ ] **Step 3: Implement animation features**

Extend keyframes with `easing`, add timeline play/pause preview helpers, add a Spine Pixi adapter that can be dependency-injected in tests, and expose `AnimationStateMachine` from `src/index.js`.

- [ ] **Step 4: Verify animation tests pass**

Run: `npx vitest run tests/production-toolchain.test.js --testNamePattern "production animation"`

Expected: PASS with the adapter's playback call recorded and the state machine changing animations.

### Task 3: Automated Asset Pipeline

**Files:**
- Create: `scripts/pack-assets.js`
- Modify: `scripts/build-platform-assets.js`
- Modify: `package.json`
- Test: `tests/production-toolchain.test.js`

- [ ] **Step 1: Write failing asset pipeline tests**

Add tests that create grouped images under `assets/sprites/characters`, run `scripts/pack-assets.js`, assert an atlas JSON with two frames, assert scene texture paths are rewritten to the atlas frame route, assert `asset-graph.json` is emitted, then rerun without changes and assert skipped count is greater than zero. Add a platform variant test that runs `build-platform-assets.js --targets web,wechat`.

- [ ] **Step 2: Run failing asset tests**

Run: `npx vitest run tests/production-toolchain.test.js --testNamePattern "production asset pipeline"`

Expected: FAIL because `pack-assets.js` and multi-target platform builds are missing.

- [ ] **Step 3: Implement asset scripts**

Group sprite files by directory, emit deterministic atlas metadata, rewrite JSON scene texture references to `atlases/<group>.atlas.json#<frame>`, emit a dependency graph with content hashes, skip unchanged groups by cache, and allow `build-platform-assets.js --targets web,wechat`.

- [ ] **Step 4: Verify asset tests pass**

Run: `npx vitest run tests/production-toolchain.test.js --testNamePattern "production asset pipeline"`

Expected: PASS with atlas, graph, rewritten scene, and separate platform outputs.

### Task 4: Device Matrix And WeChat Test Package

**Files:**
- Modify: `playwright.config.js`
- Modify: `.github/workflows/benchmark.yml`
- Create: `scripts/test-wechat.js`
- Modify: `package.json`
- Test: `tests/production-toolchain.test.js`

- [ ] **Step 1: Write failing device matrix tests**

Add tests that inspect Playwright projects for `iPhone 12`, `Pixel 5`, and `Samsung Galaxy S10`, inspect CI for CPU 2 core / 4GB low-end Android benchmark configuration, run `scripts/test-wechat.js --out <tmp>`, and assert a WeChat importable package plus `performance-report.html` with console log capture.

- [ ] **Step 2: Run failing device tests**

Run: `npx vitest run tests/production-toolchain.test.js --testNamePattern "production device matrix"`

Expected: FAIL because mobile projects and WeChat test script are incomplete.

- [ ] **Step 3: Implement matrix and WeChat script**

Add mobile Playwright projects, CI environment variables for `OMNICORE_DEVICE_CPU_CORES=2` and `OMNICORE_DEVICE_MEMORY_GB=4`, package a minimal WeChat project, collect console lines into JSON, and render an HTML performance report.

- [ ] **Step 4: Verify device tests pass**

Run: `npx vitest run tests/production-toolchain.test.js --testNamePattern "production device matrix"`

Expected: PASS with generated package files and report.

### Task 5: Official Templates And Addons

**Files:**
- Create: `examples/template-platformer/*`
- Create: `examples/template-rpg/*`
- Create: `examples/template-tilemap/*`
- Create: `src/addons/{AiPathfinding,UIManager,ParticlePack,Localization,AudioMixer,3DDecorator,CameraShake,DebugConsole,Achievement,SaveCloud}.js`
- Create: matching `src/addons/<name>.README.md`
- Modify: `src/index.js`
- Test: `tests/production-toolchain.test.js`

- [ ] **Step 1: Write failing examples/addons tests**

Add tests that assert each template has `package.json`, `README.md`, `index.html`, and `src/main.js` containing the required gameplay features, and assert all 10 addons export an object with `name`, `install`, and README usage with `OmniCore.use()`.

- [ ] **Step 2: Run failing examples/addons tests**

Run: `npx vitest run tests/production-toolchain.test.js --testNamePattern "production examples and addons"`

Expected: FAIL because templates and addon files are missing.

- [ ] **Step 3: Implement templates and addons**

Add runnable Vite templates that import OmniCore from the package root and include the requested platformer, RPG, and tilemap flows. Add one-file official addon modules with small, compatible installs and README usage.

- [ ] **Step 4: Verify examples/addons tests pass**

Run: `npx vitest run tests/production-toolchain.test.js --testNamePattern "production examples and addons"`

Expected: PASS for all templates and 10 addons.

### Task 6: Final Verification

**Files:**
- All changed files

- [ ] **Step 1: Run focused suite**

Run: `npx vitest run tests/production-toolchain.test.js`

Expected: PASS.

- [ ] **Step 2: Run related regression suites**

Run: `npx vitest run tests/editor-mvp-upgrade.test.js tests/asset-pipeline-industrial.test.js tests/device-matrix-publish-ci.test.js`

Expected: PASS.

- [ ] **Step 3: Run package script smoke tests**

Run: `npm run test:wechat -- --out .tmp/wechat-smoke`

Expected: creates `game.json`, `game.js`, `project.config.json`, `console-log.json`, and `performance-report.html`.
