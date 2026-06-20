# OmniCore Advanced Graphics And Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace OmniCore's rectangle/circle-only graphics surface with code-driven Phaser-style advanced geometry, styling, masking, slicing, tiling, transforms, and hit testing.

**Architecture:** Add focused runtime primitives under `src/graphics/`: `Geom` for shape factories and collision, `Transform2D` for local/world matrices, and `Graphics` for Canvas-renderable paths and style commands. Extend `Sprite` narrowly with slice metadata, transform support, hierarchy rendering, and bounds helpers; add `TileSprite` as a Sprite subclass. Export `Graphics`, `Geom`, `Transform2D`, and `TileSprite` through `src/index.js`.

**Tech Stack:** JavaScript ESM, Canvas 2D API command replay, Vitest, existing `Scene.Sprite` and renderer `child.render(ctx)` path.

---

## File Structure

- Create `src/graphics/Transform2D.js`
  - Matrix helpers, transform normalization, parent/child world matrix, Canvas application.
- Create `src/graphics/Geom.js`
  - `OmniCore.Geom` static factories for Arc, Ellipse, Polygon, Triangle, Line and shape hit/intersection helpers.
- Create `src/graphics/Graphics.js`
  - Chainable path API, curves, arcs, gradients, blend modes, pattern fills, masks, clips, bounds and hit testing.
- Create `src/scene/TileSprite.js`
  - Repeating sprite primitive with tile offset and tile scale.
- Modify `src/scene/Scene.js`
  - Add transform, slice, child hierarchy, bounds and 9-slice render support to `Sprite`.
- Modify `src/index.js`
  - Export `Graphics`, `Geom`, `Transform2D`, and `TileSprite`; include them in `OmniCore`.
- Create `tests/advanced-graphics-geom.test.js`
  - Geometry factories, path commands, bounds/contains/intersects.
- Create `tests/advanced-graphics-rendering.test.js`
  - Canvas replay for curves, gradients, blend modes, pattern fills, masks, clipping.
- Create `tests/sprite-tilesprite-transform.test.js`
  - Sprite slice, tile sprite rendering, local/world transform hierarchy.

## Tasks

### Task 1: Geometry And Collision

- [ ] Write failing tests for `Geom.Arc`, `Geom.Ellipse`, `Geom.Polygon`, `Geom.Triangle`, `Geom.Line`, `bounds()`, `containsPoint()`, and `intersects()`.
- [ ] Run `npx vitest run tests/advanced-graphics-geom.test.js` and verify failure due missing exports.
- [ ] Implement `src/graphics/Geom.js` with deterministic plain objects and helper methods.
- [ ] Export `Geom` from `src/index.js`.
- [ ] Re-run `npx vitest run tests/advanced-graphics-geom.test.js` and verify pass for geometry-only assertions.

### Task 2: Graphics Path And Style API

- [ ] Extend failing tests with `Graphics.bezierCurveTo`, `quadraticCurveTo`, `arc`, `gradient`, `blendMode`, Sprite pattern fill, `beginMask`, `endMask`, and `clip`.
- [ ] Run `npx vitest run tests/advanced-graphics-rendering.test.js` and verify failure due missing `Graphics`.
- [ ] Implement `src/graphics/Graphics.js` as a chainable command recorder and Canvas renderer.
- [ ] Export `Graphics` from `src/index.js`.
- [ ] Re-run the advanced graphics rendering test and verify pass.

### Task 3: Transform, 9-Slice Sprite, And TileSprite

- [ ] Write failing tests for `Sprite.slice(top, bottom, left, right)`, `TileSprite`, and parent/child world transforms.
- [ ] Run `npx vitest run tests/sprite-tilesprite-transform.test.js` and verify failure due missing methods/classes.
- [ ] Implement `src/graphics/Transform2D.js`, enhance `Sprite`, and create `src/scene/TileSprite.js`.
- [ ] Export `TileSprite` and `Transform2D` from `src/index.js`.
- [ ] Re-run sprite/tile/transform tests and verify pass.

### Task 4: Focused Verification

- [ ] Run `npx vitest run tests/advanced-graphics-geom.test.js tests/advanced-graphics-rendering.test.js tests/sprite-tilesprite-transform.test.js tests/vector-primitives.test.js`.
- [ ] Run `npx eslint -c .eslintrc.json --no-eslintrc src/graphics/*.js src/scene/Scene.js src/scene/TileSprite.js src/index.js tests/advanced-graphics-geom.test.js tests/advanced-graphics-rendering.test.js tests/sprite-tilesprite-transform.test.js`.
- [ ] Fix any errors or warnings without weakening tests.

## Self-Review

- Spec coverage: geometry factories, curves/arcs, gradients/blend/patterns, masks/clips, slice/tile sprites, transform matrices, and collision APIs are each covered by at least one task and test file.
- Placeholder scan: no task relies on vague placeholders; each has concrete files and commands.
- Type consistency: exported names match user-facing API: `OmniCore.Graphics`, `OmniCore.Geom`, `OmniCore.TileSprite`, and `OmniCore.Transform2D`.
