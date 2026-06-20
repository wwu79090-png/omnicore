# OmniCore Visual Audio UI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the OmniCore parity gap for complex primitives, advanced fills, masking/blending, HTML overlay UI, rich text, complete audio control, tween sequences, particles, and UI state transitions.

**Architecture:** Extend the existing descriptor-first renderer path instead of adding dependencies. `VectorPrimitives` remains the shared command format; Canvas and lean renderers replay the same commands. UI, audio, tween, particles, and state transitions are implemented as small runtime modules exported through `src/index.js`.

**Tech Stack:** JavaScript ESM, Canvas 2D command replay, Web Audio API abstractions, Vitest, existing OmniCore renderer/UI/audio/tween architecture.

---

## File Structure

- Modify `src/renderer/VectorPrimitives.js`
  - Add sector, bezier, polygon factories plus linear/radial gradient and texture fill descriptors.
  - Preserve existing house/ring/capsule/code-layer APIs.
- Modify `src/addons/CanvasRenderer.js`
  - Replay sector, bezier, advanced fills, masks, blend modes, and rich text.
- Modify `src/lean/addons/Renderer.js`
  - Consume the same vector commands through the lean Canvas/Pixi-compatible path.
- Create `src/ui/HtmlOverlay.js`
  - Manage DOM overlay layers without replacing Canvas UI.
- Create `src/ui/RichText.js`
  - Layout wrapped rich text lines with stroke and shadow metadata for Canvas rendering.
- Modify `src/audio/AudioManager.js`
  - Add audio pools, master/bus volume helpers, fade-in and fade-out.
- Modify `src/tween/Tween.js`
  - Add `Tween.to`, `Tween.fromTo`, and `Tween.sequence` for UI transitions and sequence-frame-style animation.
- Create `src/particles/ParticleSystem.js`
  - Add deterministic pooled particle emission, update, and Canvas render descriptors.
- Create `src/ui/UIStateMachine.js`
  - Add panel/menu state transitions with animation hooks.
- Modify `src/index.js`
  - Export the new factories and modules.
- Create `tests/visual-audio-ui-foundation.test.js`
  - Cover every missing capability with executable minimal regression tests.
- Create `docs/visual-audio-ui-foundation.md`
  - Document the public APIs and manual verification checklist.

## Tasks

### Task 1: Failing Contract Tests

- [ ] Create `tests/visual-audio-ui-foundation.test.js` with tests for complex primitives, advanced fills, masks/blends, rich text, HTML overlay, audio pools/fades, tween sequences, particles, and UI state transitions.
- [ ] Run `npx vitest run tests/visual-audio-ui-foundation.test.js`.
- [ ] Verify RED due missing exports such as `createSectorPrimitive`, `HtmlOverlay`, `ParticleSystem`, and `UIStateMachine`.

### Task 2: Renderer Primitives And Styling

- [ ] Implement sector, bezier, polygon, gradient, texture fill, mask, blend, and rich text command descriptors in `src/renderer/VectorPrimitives.js`.
- [ ] Extend `src/addons/CanvasRenderer.js` and `src/lean/addons/Renderer.js` to replay these commands.
- [ ] Run `npx vitest run tests/visual-audio-ui-foundation.test.js tests/vector-primitives.test.js tests/advanced-graphics-geom.test.js`.

### Task 3: UI And Text Runtime

- [ ] Implement `src/ui/HtmlOverlay.js` for DOM overlay mounting, updates, pointer mode, z-index, and cleanup.
- [ ] Implement `src/ui/RichText.js` for wrapped lines, segment styles, stroke, shadow, and Canvas command conversion.
- [ ] Export both through `src/index.js`.
- [ ] Re-run the focused UI/text tests.

### Task 4: Audio, Tween, Particles, State Machine

- [ ] Extend `AudioManager` with `setMasterVolume`, `createPool`, `playFromPool`, `fadeIn`, and `fadeOut`.
- [ ] Extend `Tween` with static helpers and deterministic sequence updates.
- [ ] Implement `ParticleSystem` with pooled particles, color/size over lifetime, blending, and render commands.
- [ ] Implement `UIStateMachine` with enter/exit hooks, transition records, and update-driven progress.
- [ ] Re-run the focused tests.

### Task 5: Docs, Exports, And Verification

- [ ] Update `docs/visual-audio-ui-foundation.md` with API examples and manual validation steps.
- [ ] Run API contract snapshot update if exports changed.
- [ ] Run `npx vitest run tests/visual-audio-ui-foundation.test.js tests/vector-primitives.test.js tests/advanced-graphics-geom.test.js tests/advanced-2d-systems.test.js tests/omnicore.test.js`.
- [ ] Run `npm run test`.
- [ ] Run `npm run build` and verify `dist/omnicore.esm.js` exists.

## Self-Review

- Spec coverage: every requested area has a test-backed task.
- Placeholder scan: no placeholder task; each step lists exact files and commands.
- Type consistency: user-facing exports are `createSectorPrimitive`, `createBezierPrimitive`, `createPolygonPrimitive`, `linearGradientFill`, `radialGradientFill`, `textureFill`, `HtmlOverlay`, `RichText`, `ParticleSystem`, and `UIStateMachine`.
