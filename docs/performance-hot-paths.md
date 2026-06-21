# OmniCore Performance Hot Paths

OmniCore no longer applies an engine-level FPS cap by default. The main loop follows the host scheduler (`requestAnimationFrame` in browsers, `setTimeout(0)` in non-vsync fallback mode) unless `fps` or `framerateCap` is explicitly provided.

```js
const game = new OmniCore.Game({
  renderer: 'webgpu',
  autoStart: true
});

// Optional explicit cap, only when a project asks for one.
const cinematic = new OmniCore.Game({ framerateCap: 30 });
```

## Render Queue Batching

`optimizeRenderQueueForBatching(commands)` groups safe commands by layer, texture, material, blend mode, and pipeline. Masked, filtered, or explicitly blocked commands remain barriers.

```js
const plan = OmniCore.optimizeRenderQueueForBatching(sceneDrawCommands);
renderer.submit(plan.commands);
```

## Runtime Object Pools

`createRuntimeObjectPools()` covers hot allocation types: `Sprite`, `Tween`, `Particle`, and `Event`.

```js
const pools = OmniCore.createRuntimeObjectPools({ warm: { Sprite: 128, Particle: 512 } });
const bullet = pools.acquire('Sprite', { texture: 'bullet.png' });
pools.release('Sprite', bullet);
```

## Dirty Flag Sync

`DirtyFlagTracker` records changed render properties and syncs only dirty entities each frame.

```js
const dirty = new OmniCore.DirtyFlagTracker({ sync: (entity, props) => renderer.patch(entity, props) });
dirty.track(hero, 'hero');
dirty.set(hero, 'x', 64);
dirty.syncOnlyDirty();
```

## Async Assets

`createAsyncAssetPipeline()` loads critical first-frame assets first and defers lazy decode/upload work to background flushes.

```js
const pipeline = OmniCore.createAsyncAssetPipeline();
await pipeline.loadFrame([{ id: 'hero', url: 'hero.png', critical: true }]);
await pipeline.flushBackground({ limit: 8 });
```

## Spatial Index

`EntitySpatialIndex` updates cell membership incrementally through `x`/`y` property hooks. `createIncrementalSpatialIndexReport(index)` exposes update counters for debug panels and benchmarks.

## Worker Lanes

`WorkerTaskScheduler` routes heavyweight jobs to clear lanes: `logic`, `physics`, `loading`, and `ai`. If Worker is unavailable, it returns main-thread fallback evidence.

## Texture Budget

`createTextureBudgetPlan()` emits an adaptive downgrade plan from memory, FPS, and texture-count pressure. It controls texture scale, particle scale, filter quality, mipmaps, and anisotropy.

## Tilemap Streaming

`createTilemapChunkStreamPlan()` computes visible, preloaded, kept, loaded, and unloaded chunks from viewport bounds.

## Animation LOD

`createAnimationLODPlan()` lowers sampling for far actors, pauses offscreen animations, and disables FFD outside the near band.

## WebGPU Hot Paths

WebGPU helpers describe actual GPU-side batching:

- `createWebGPUInstancingDescriptor()` for one draw call over many sprite instances.
- `createWebGPUTextureArrayBatch()` for texture-array layer packing.
- `createWebGPUComputeDispatchPlan()` for compute workgroup dispatch sizing.
