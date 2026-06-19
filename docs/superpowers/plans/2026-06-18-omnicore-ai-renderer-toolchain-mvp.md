# OmniCore AI Renderer Toolchain MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable first vertical slice for AI-assisted scene authoring, renderer abstraction, debug editors, marketplace prototype, and PR automation.

**Architecture:** Add small opt-in modules around current OmniCore seams instead of replacing stable runtime paths. AI output becomes validated JSON commands; renderer backends implement a shared contract; debug editors export Store-friendly custom formats; marketplace and CI are prototypes.

**Tech Stack:** JavaScript ESM, Vitest, Vite, Playwright workflow, WebGPU browser API feature detection, Node crypto.

---

### Task 1: AI Command Service and F1 Console

**Files:**
- Create: `src/ai/AICommandService.js`
- Modify: `src/debug/ApiQuickPanel.js`
- Modify: `src/index.js`
- Test: `tests/ai-toolchain-mvp.test.js`

- [ ] Write tests for generating and injecting a WASD player command.
- [ ] Implement `AICommandService.generateCommand(prompt)` with provider and local fallback.
- [ ] Implement `AICommandService.inject(command, game)` to add scene entities and movement components.
- [ ] Add an AI command input to F1 panel and call the service.
- [ ] Export `AICommandService` from public API.

### Task 2: AI Tilemap Generator

**Files:**
- Create: `src/tilemap/AITilemapGenerator.js`
- Modify: `src/tilemap/Tilemap.js`
- Modify: `src/index.js`
- Test: `tests/ai-toolchain-mvp.test.js`

- [ ] Write tests for forest, lake, and cliff prompt markers.
- [ ] Implement deterministic tile matrix generation.
- [ ] Add `Tilemap.generateWithAI(prompt, options)`.
- [ ] Return both `tilemap` and standard `sceneJson`.

### Task 3: Renderer Contract and WebGPU Prototype

**Files:**
- Create: `src/renderer/RendererBackend.js`
- Create: `src/renderer/WebGPURenderer.js`
- Modify: `src/renderer/RendererManager.js`
- Modify: `src/core/OmniCore.js`
- Modify: `src/index.js`
- Test: `tests/renderer-backends-mvp.test.js`

- [ ] Write tests for backend contract validation and WebGPU feature detection fallback.
- [ ] Implement `assertRendererBackend(renderer)`.
- [ ] Implement WebGPU prototype with `init`, `renderScene`, `resize`, `fade`, `destroy`.
- [ ] Allow `renderer` or `backend` config value `webgpu`.
- [ ] Keep Pixi/Canvas behavior unchanged.

### Task 4: Electron Native Bridge Stub

**Files:**
- Create: `src/platform/ElectronNativeBridge.js`
- Modify: `src/index.js`
- Test: `tests/renderer-backends-mvp.test.js`

- [ ] Write tests for Electron capability detection.
- [ ] Implement Direct3D/Vulkan bridge metadata without claiming real native output.
- [ ] Export `ElectronNativeBridge`.

### Task 5: Runtime Editors and Formats

**Files:**
- Create: `src/editor/SkeletonAnimationEditor.js`
- Create: `src/data/DataTableEditor.js`
- Create: `src/audio/AudioEditor.js`
- Modify: `src/index.js`
- Test: `tests/tool-editors-mvp.test.js`

- [ ] Write tests for `.omni-anim` export.
- [ ] Write tests for CSV to JSON and version rollback.
- [ ] Write tests for audio config edits and export.
- [ ] Implement compact editor models that work without DOM.

### Task 6: Marketplace Prototype

**Files:**
- Create: `src/marketplace/MarketplaceServer.js`
- Modify: `src/index.js`
- Test: `tests/marketplace-ci-mvp.test.js`

- [ ] Write tests for paid plugin registration.
- [ ] Write tests for encrypted download payload and revenue split.
- [ ] Implement in-memory marketplace service prototype.

### Task 7: PR Quality Workflow

**Files:**
- Create: `.github/workflows/pr-quality.yml`
- Test: `tests/marketplace-ci-mvp.test.js`

- [ ] Write tests that inspect workflow contents.
- [ ] Add PR workflow for lint, unit tests, e2e, benchmark, and artifact upload.

### Task 8: Verification

**Files:**
- Modify as needed based on lint/test feedback.

- [ ] Run `npm test -- tests/ai-toolchain-mvp.test.js tests/renderer-backends-mvp.test.js tests/tool-editors-mvp.test.js tests/marketplace-ci-mvp.test.js`.
- [ ] Run `npm run lint -- src tests scripts`.
- [ ] Run `npm run build`.
- [ ] Run `npm test` and document any pre-existing failures separately.
