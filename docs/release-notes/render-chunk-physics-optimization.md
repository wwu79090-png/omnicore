# Render, Chunk, And Physics Optimization

Generated: 2026-06-18

## Pixi Batch Rendering

- Added `BatchOptimizer` for Pixi sprite batch analysis.
- `PixiRenderer` now caches `Texture.from()` lookups and publishes `renderer:drawCalls` / `renderer:batchStats` into Store.
- 1000 sprites sharing the same atlas key are grouped into one estimated Pixi batch draw call with a 60 FPS target.

## Tilemap Chunking

- `Tilemap.createChunkManager()` creates a runtime chunk manager directly from parsed Tiled maps.
- `ChunkManager` now hydrates tile payloads only for viewport-visible chunks.
- Offscreen chunks release tile data and cached texture payloads.
- Active chunks expose `getRenderableTiles()`, `getCollisionObjects()`, and `estimateMemoryBytes()`.

## Physics Queries

- Added shared `PhysicsQuery` for Matter-compatible spatial scans.
- `PhysicsAddon.query.raycast(startX, startY, endX, endY)` returns entities hit by a forward ray.
- `PhysicsAddon.query.circle(x, y, radius)` returns entities inside an area scan.
- `PhysicsWorld` exposes the same query API for non-lean runtime integration.

## Verification

- `npm test -- tests/render-chunk-physics-optimization.test.js`
- `npm test -- tests/polish-pass.test.js tests/benchmark-threshold.test.js tests/contract/api-contract-snapshot.test.js`
- `npm run audit:api`
- `npm test` -> 24 files / 141 tests passed
- `npm run lint` -> passed
- `npm run build` -> passed
- `npm run benchmark` -> Pixi 1000 Sprite summary: 60 FPS, 1 draw call
- `npm run benchmark:ci` -> passed
