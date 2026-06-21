# OmniCore User Conversion Feature Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the remaining product-maturity feature gaps that affect first-user adoption: playable templates, API examples, WebGPU evidence, editor export, asset conversion, plugin examples, mobile/WeChat proof, and Chinese doctor diagnostics.

**Architecture:** Keep changes additive and aligned with existing OmniCore modules. Use static examples, deterministic descriptors, CLI reports, and editor API exports instead of introducing new dependencies or replacing current runtime/editor architecture.

**Tech Stack:** JavaScript ESM, Vitest, existing OmniCore runtime/editor scripts, static HTML/CSS examples, Node.js filesystem utilities.

---

### Task 1: Acceptance Tests

**Files:**
- Create: `tests/user-conversion-feature-closure.test.js`

- [x] Add tests that require three playable official templates, API cookbook docs, WebGPU texture/shader/hardware evidence descriptors, editor one-click export, real conversion report metadata, plugin samples, mobile/WeChat evidence, and Chinese doctor suggestions.
- [x] Run the new test file and confirm it fails before implementation.

### Task 2: Playable Templates And API Cookbook

**Files:**
- Create/Modify: `examples/official-templates/platformer`, `examples/official-templates/rpg-dialogue`, `examples/official-templates/bullet-heaven`
- Create: `docs/api-cookbook.md`
- Modify: `README.md`

- [x] Each template includes `package.json`, `index.html`, `src/main.js`, `README.md`, and `omnicore.template.json`.
- [x] Cookbook contains copy-ready snippets for Sprite, Scene, Tween, Input, Audio, Loader, Mask, 2.5D, Physics adapter, HTML overlay, and export.

### Task 3: WebGPU Evidence And Rendering Descriptors

**Files:**
- Modify: `src/renderer/WebGPURenderer.js`
- Create: `scripts/capture-webgpu-evidence.js`
- Create: `docs/webgpu-hardware-evidence.md`

- [x] Add texture atlas layout, bind group descriptor, shader variant registry, and hardware evidence payload generation.
- [x] Provide CLI output for browser/device/GPU evidence without requiring live WebGPU in CI.

### Task 4: Editor Export Closed Loop

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Create: `scripts/export-editor-project.js`
- Create: `docs/editor-export-workflow.md`

- [x] Add `exportRunnableProject()` to editor API with files for `package.json`, `index.html`, `src/main.js`, `assets/manifest.json`, and `README.md`.
- [x] Add a CLI that writes that export bundle to disk.

### Task 5: Asset Conversion, Plugins, Mobile, Doctor

**Files:**
- Modify: `scripts/asset-importer.js`
- Modify: `scripts/engine-doctor.js`
- Modify: `scripts/generate-mobile-shells.js`
- Create: `examples/plugins/Leaderboard`, `examples/plugins/Achievements`, `examples/plugins/WechatCapabilities`
- Create: `docs/platforms/mobile-wechat-evidence.md`

- [x] Asset importer reports concrete external command plans for Spine, Blender, PNG atlas padding, bitmap font, and audio conversion.
- [x] Plugin samples cover leaderboard, achievements, and WeChat capabilities.
- [x] Mobile shell generation writes a smoke evidence checklist.
- [x] Engine doctor emits Chinese diagnosis items for resource 404, font failures, WebGL/WebGPU support, npm pending, Vercel wrong site, and WeChat package state.

### Task 6: Verification And Release

**Files:**
- All changed files.

- [x] Run focused new tests.
- [x] Run lint.
- [x] Run full test suite.
- [x] Run build and key release gates.
- [ ] Commit and push.
