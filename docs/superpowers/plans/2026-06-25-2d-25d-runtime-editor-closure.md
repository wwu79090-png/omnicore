# 2D/2.5D Runtime And Editor Closure

> **For:** OmniCore engine 2D/2.5D capability pass
> **Created:** 2026-06-25
> **Status:** In progress

## Goal

Strengthen the engine's primary 2D and 2.5D path with one usable planning/runtime entry that combines the systems creators expect in real projects: tilemap streaming, Arcade-style collision evidence, camera follow, parallax, 2.5D depth sorting and occlusion, 2D lighting/shadow commands, editor inspector/export metadata, and runtime sync payloads.

## Scope

- Add a focused runtime/editor pipeline API under the tilemap/2D surface.
- Reuse existing `Tilemap`, `Camera`, `Light2D`, and chunk streaming utilities instead of making a parallel stack.
- Keep the implementation DOM-free and deterministic so it can run in tests, editor previews, server-side validation, and export tooling.
- Export the new API from `src/index.js`.

## Checks

- `npm test -- tests/scene-2d-25d-runtime-editor-closure.test.js`
- `npm test -- tests/scene-2d-25d-runtime-editor-closure.test.js tests/advanced-2d-systems.test.js tests/dimension25d-enhancements.test.js tests/living-world-25d.test.js tests/preview-25d-bundle.test.js`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Acceptance

- A creator can build one 2D/2.5D scene plan and get tilemap, camera, collision, lighting, depth, editor, export, and runtime sync sections from a single stable API.
- The pipeline exposes data an editor can render directly: inspector sections, debug draw commands, hot reload topics, and export targets.
- The implementation is covered by a dedicated test and at least one existing 2D/2.5D regression set.
