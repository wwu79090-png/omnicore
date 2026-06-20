# OmniCore Industrial 2.5D Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Web-runnable industrial 2.5D MVP pipeline in OmniCore across Editor, Renderer, Camera/Scene/Dimension3D, asset import, batching, and a market-facing demo.

**Architecture:** Keep the work additive and backward-compatible. Use focused metadata/descriptor modules for shader materials, batching, import reports, and editor preview APIs so the existing runtime keeps working without new dependencies. Treat `.blend` and `.spine` conversion as deterministic import pipeline detection plus optional external converter hooks.

**Tech Stack:** JavaScript ESM, PixiJS v8 filters/descriptors, Three.js metadata hooks, OmniCore Editor DOM app, Vitest, existing asset importer scripts.

---

### Task 1: Renderer Shader And Material Descriptors

**Files:**
- Modify: `src/renderer/Filters.js`
- Modify: `src/animation/SkeletalAnimation.js`
- Modify: `src/index.js`
- Test: `tests/industrial-25d-pipeline.test.js`

- [x] **Step 1: Write failing renderer/material tests**

Add tests that import `createHD2DFilter`, `createNormalLightShader`, `createSpineFFDVertexShader`, and `SpineAdapter`, then assert stable descriptors for HD-2D chromatic offset, normal-map lighting uniforms, and custom Spine FFD vertex shader metadata.

- [x] **Step 2: Run test to verify RED**

Run: `npx vitest run tests/industrial-25d-pipeline.test.js`

Expected: FAIL because the new functions are not exported.

- [x] **Step 3: Implement descriptors**

Add descriptor factories in `Filters.js`; add `customVertexShader`, `ffd`, and `lod` metadata support to `SpineAdapter.create()`.

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run tests/industrial-25d-pipeline.test.js`

Expected: PASS for renderer/material cases.

### Task 2: Camera, Scene, And 2.5D Render Plan Integration

**Files:**
- Modify: `src/camera/Camera.js`
- Modify: `src/scene/Scene.js`
- Modify: `src/dimension3d/Dimension3D.js`
- Test: `tests/industrial-25d-pipeline.test.js`

- [x] **Step 1: Write failing scene/camera tests**

Add tests for parallax presets `{background:0.5, actors:1, ui:0}`, dynamic Y sort, fake shadow correction, and 2D/3D viewport sync payloads.

- [x] **Step 2: Run test to verify RED**

Run: `npx vitest run tests/industrial-25d-pipeline.test.js`

Expected: FAIL on missing APIs.

- [x] **Step 3: Implement minimal APIs**

Add `Camera.configureParallax2D()`, `Camera.getLayerTransform(id)`, `Scene.apply25DSort()`, and `Dimension3D.syncViewport2D()`.

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run tests/industrial-25d-pipeline.test.js`

Expected: PASS.

### Task 3: Editor 2.5D Visual Workflow

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/industrial-25d-pipeline.test.js`

- [x] **Step 1: Write failing editor workflow tests**

Add tests for realtime 2.5D preview guides, mixed Spine/Dimension3D drag payloads, and one-click fake shadow metadata.

- [x] **Step 2: Run test to verify RED**

Run: `npx vitest run tests/industrial-25d-pipeline.test.js`

Expected: FAIL on missing editor APIs.

- [x] **Step 3: Implement editor APIs**

Add `create25DPreview()`, `drag25DNode()`, and `generateFakeShadows()` to the editor app public API.

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run tests/industrial-25d-pipeline.test.js`

Expected: PASS.

### Task 4: Batching And LOD Planning

**Files:**
- Modify: `src/renderer/StaticBatchCompiler.js`
- Test: `tests/industrial-25d-pipeline.test.js`

- [x] **Step 1: Write failing batching tests**

Assert fixed 3D decor models become instanced batches, Spine nodes group by atlas/material/state, and distance LOD disables FFD and lowers texture precision.

- [x] **Step 2: Run test to verify RED**

Run: `npx vitest run tests/industrial-25d-pipeline.test.js`

Expected: FAIL on missing batch compiler methods.

- [x] **Step 3: Implement batch planning methods**

Add `compileStaticModelInstances()`, `compileSpineDrawCallGroups()`, and `plan25DLOD()`.

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run tests/industrial-25d-pipeline.test.js`

Expected: PASS.

### Task 5: 2.5D Asset Import Pipeline

**Files:**
- Modify: `scripts/asset-importer.js`
- Modify: `scripts/import-assets.js`
- Test: `tests/industrial-25d-pipeline.test.js`

- [x] **Step 1: Write failing import tests**

Use temp source assets with `.spine`, `.blend`, and transparent `.png`; assert `.skel/.atlas/.glb` targets, optional external converter metadata, edge padding, and atlas packing reports.

- [x] **Step 2: Run test to verify RED**

Run: `npx vitest run tests/industrial-25d-pipeline.test.js`

Expected: FAIL on missing conversion reports.

- [x] **Step 3: Implement deterministic import reports**

Detect `.spine` and `.blend`; create placeholder outputs only when no converter is configured; always record converter expectation and edge padding metadata.

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run tests/industrial-25d-pipeline.test.js`

Expected: PASS.

### Task 6: Market-Facing 2.5D Demo

**Files:**
- Create: `examples/2.5d-demo/package.json`
- Create: `examples/2.5d-demo/index.html`
- Create: `examples/2.5d-demo/src/main.js`
- Create: `examples/2.5d-demo/README.md`
- Test: `tests/industrial-25d-pipeline.test.js`

- [x] **Step 1: Write failing demo tests**

Assert demo files exist and mention Spine FFD, dynamic occlusion, 3D city decor, parallax camera, and HD-2D filter.

- [x] **Step 2: Run test to verify RED**

Run: `npx vitest run tests/industrial-25d-pipeline.test.js`

Expected: FAIL because the demo folder does not exist.

- [x] **Step 3: Create demo files**

Add a no-server Vite-compatible demo that uses OmniCore exports and local placeholder assets/metadata.

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run tests/industrial-25d-pipeline.test.js`

Expected: PASS.

### Task 7: Full Verification And Release Handoff

**Files:**
- Generated docs/reports as affected by build/test

- [x] **Step 1: Run focused tests**

Run: `npx vitest run tests/industrial-25d-pipeline.test.js tests/dimension3d-25d-hardening.test.js`

- [x] **Step 2: Run full tests**

Run: `npm run test`

- [x] **Step 3: Run production build**

Run: `npm run build`

- [ ] **Step 4: Commit and push**

Run: `git add -A && git commit -m "feat: add industrial 2.5d pipeline" && git push -u origin codex/contract-benchmark-ci`

---

## Self-Review

- Spec coverage: all six requested dimensions map to Tasks 1-6.
- Placeholder scan: no TBD/TODO items remain; `.blend/.spine` conversion boundary is explicit.
- Type consistency: public APIs use `25D` suffix for Editor/Scene/LOD helpers and descriptor factories are plain ESM exports.
