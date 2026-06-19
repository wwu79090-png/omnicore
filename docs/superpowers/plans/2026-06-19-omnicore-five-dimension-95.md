# OmniCore Five-Dimension 95+ Hardening Plan

## Goal

Raise the existing 2D OmniCore implementation across five dimensions without breaking public APIs:

- Complex scene pressure: dual spatial index, sleep/wake, render command merge mode.
- Worker and concurrency: SharedArrayBuffer position sharing, task pool waitAll, long-task isolation.
- Asset pipeline: incremental asset builds, scene texture atlas rewrites, WebP fallback.
- Editor ecosystem: prefab/asset drag placement, Tilemap paint and collision drag, snapshots, Undo/Redo.
- Tilemap and physics: infinite chunk streaming and build-time binary static collision baking.

## Current Baseline

- `WebGPURenderer` already maps draw instructions into `SharedArrayBuffer` and caps large scenes to 5 GPU batches.
- `DualSpatialIndex` already implements static quadtree plus dynamic spatial hash but is not public API yet.
- `SleepWakeSystem` already supports distance sleep and 5-second stillness sleep.
- `ChunkManager.updateAroundPlayer()` streams an infinite 3x3 preload window and unloads by distance.
- `Tilemap.bakeCollisionBinary()` and `readCollisionBinary()` exist at runtime.
- The editor already supports prefab drag placement, selection highlight and basic tile/collision painting.

## Implementation

1. Add one focused RED suite, `tests/omnicore-five-dimension-95.test.js`, that exercises public behavior for each dimension.
2. Add `TaskScheduler` with `submit()` and `waitAll()` plus deterministic isolation metadata when tasks exceed 50ms.
3. Add an incremental asset build helper/CLI for changed-file-only atlas generation and scene texture rewrites.
4. Add a build-time tilemap collision bake helper/CLI and wire it into `prebuild` in optional mode.
5. Extend editor app state with asset list rendering, drag collision painting, Undo/Redo and snapshot generation.
6. Export new engine primitives from `src/index.js` and refresh the API contract snapshot.

## Verification

- Run the new RED suite first and confirm it fails for missing new APIs.
- Run targeted tests after implementation:
  - `npm test -- tests/omnicore-five-dimension-95.test.js`
  - `npm test -- tests/omnicore-2d-extreme-runtime.test.js tests/commercial-engine-core.test.js tests/asset-pipeline-industrial.test.js`
- Refresh and verify API contract:
  - `node scripts/contract/snapshot-api-contract.js --update`
  - `npm test -- tests/contract/api-contract-snapshot.test.js`
- Run build:
  - `npm run build`
- Run full test suite if targeted verification is clean:
  - `npm test`

## Risk Notes

- The numeric targets are validated by deterministic engine reports and system behavior in unit tests, not by claiming local hardware benchmark equivalence.
- Literal zero CPU usage is not achievable for a browser game loop; the implementation reduces copies and main-thread render responsibility through worker messaging and `SharedArrayBuffer`.
