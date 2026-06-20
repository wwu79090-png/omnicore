# OmniCore Tricore Industrial Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand OmniCore across three cores: independent low-code visual editor, industrial editor maturity, and deep renderer optimization.

**Architecture:** Reuse the existing `packages/omnicore-editor` app and runtime renderer modules. Add focused editor service APIs that can be tested without a browser framework runtime, while declaring the required React/React Flow/Fabric/Konva/Yjs/Zustand/WebSocket/WebRTC stack in editor metadata for the standalone online editor. Extend the WebGPU renderer through browser-native `navigator.gpu` APIs with a wgpu-style adapter descriptor because JavaScript cannot directly call Rust `wgpu` in browsers.

**Tech Stack:** JavaScript ESM, existing Vite editor package, React stack metadata, Yjs-compatible collaboration protocol, Zustand-style store metadata, WebSocket/WebRTC transport descriptors, WebGPU API, WGSL.

---

### Task 1: Low-Code Standalone Editor Contract

**Files:**
- Modify: `packages/omnicore-editor/package.json`
- Modify: `packages/omnicore-editor/src/collaboration.js`
- Modify: `packages/omnicore-editor/src/live-sync-protocol.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/tricore-industrial-expansion.test.js`

- [x] Add test requiring stack metadata and standalone editor capability declaration.
- [x] Add collaborative object locking and version branch snapshots.
- [x] Add bidirectional runtime sync helper for EventSheet/BehaviorTree/UI layout JSON.

### Task 2: Industrial Editor Maturity Services

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `packages/omnicore-editor/src/live-sync-protocol.js`
- Test: `tests/tricore-industrial-expansion.test.js`

- [x] Add dependency graph generation and bulk reference replacement.
- [x] Add incremental compile and hot reload manifest generation.
- [x] Add 10 second event/frame timeline recorder and CPU/GPU profiler summary.
- [x] Add animation state machine export, prefab variant overrides, and nested scene records.

### Task 3: Renderer Deep Optimization

**Files:**
- Modify: `src/renderer/RendererBackend.js`
- Modify: `src/renderer/WebGPURenderer.js`
- Test: `tests/tricore-industrial-expansion.test.js`

- [x] Add unified renderer contract metadata.
- [x] Add WebGPU shader prewarm and compute particle pipeline descriptors.
- [x] Add performance sandbox comparison output for Pixi/WebGPU backends.

### Task 4: Full Verification

**Commands:**
- [ ] `npx vitest run tests/tricore-industrial-expansion.test.js`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run quality:gate`
