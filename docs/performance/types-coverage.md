# TypeScript Declaration Coverage

OmniCore ships `dist/omnicore.d.ts` for public ESM consumers. The coverage gate checks that hot-path performance APIs exported by the runtime are also present in generated declarations.

## Covered API Families

- Render queue batching: `optimizeRenderQueueForBatching`
- Runtime pools: `createRuntimeObjectPools`
- Dirty sync: `DirtyFlagTracker`
- Async loading and spatial index reports
- Worker task scheduling
- Texture budget, tilemap streaming, animation LOD
- WebGPU instancing, texture-array batching, and compute dispatch descriptors

## Minimal Verification

```bash
npm run types:coverage
```

The command writes `docs/release-notes/types-coverage-report.json` and exits non-zero if a required symbol is missing.
