import { describe, expect, it } from 'vitest';
import OmniCore, {
  EntitySpatialIndex,
  WorkerManager
} from '../src/index.js';

describe('performance hot path governance suite', () => {
  it('reorders safe render commands to reduce draw calls without crossing layers', () => {
    const plan = OmniCore.optimizeRenderQueueForBatching([
      { id: 'hero-a', layer: 'world', zIndex: 0, texture: 'hero.png', material: 'sprite', blendMode: 'normal' },
      { id: 'crate', layer: 'world', zIndex: 1, texture: 'props.png', material: 'sprite', blendMode: 'normal' },
      { id: 'hero-b', layer: 'world', zIndex: 2, texture: 'hero.png', material: 'sprite', blendMode: 'normal' },
      { id: 'hud', layer: 'ui', zIndex: 0, texture: 'ui.png', material: 'sprite', blendMode: 'normal' }
    ]);

    expect(plan.beforeDrawCalls).toBe(4);
    expect(plan.afterDrawCalls).toBe(3);
    expect(plan.savedDrawCalls).toBe(1);
    expect(plan.commands.map((command) => command.id)).toEqual(['hero-a', 'hero-b', 'crate', 'hud']);
    expect(plan.groups[0]).toMatchObject({
      batchKey: 'world|hero.png|sprite|normal|default',
      commandIds: ['hero-a', 'hero-b']
    });
  });

  it('provides reusable Sprite, Tween, Particle, and Event pools', () => {
    const pools = OmniCore.createRuntimeObjectPools({
      warm: {
        Sprite: 1,
        Tween: 1,
        Particle: 1,
        Event: 1
      }
    });

    const sprite = pools.acquire('Sprite', { id: 'bullet' });
    pools.release('Sprite', sprite);
    const reused = pools.acquire('Sprite');

    expect(reused).toBe(sprite);
    expect(pools.report().types.map((type) => type.name)).toEqual(['Sprite', 'Tween', 'Particle', 'Event']);
    expect(pools.report().types.find((type) => type.name === 'Sprite')).toMatchObject({
      acquired: 2,
      released: 1,
      reused: 1
    });
  });

  it('syncs only dirty render records and clears the frame delta', () => {
    const synced = [];
    const tracker = new OmniCore.DirtyFlagTracker({
      sync: (entity, properties, record) => synced.push({
        id: record.id,
        properties: [...properties]
      })
    });
    const hero = { x: 0, y: 0, alpha: 1 };
    const npc = { x: 10, y: 0 };

    tracker.track(hero, 'hero');
    tracker.track(npc, 'npc');
    tracker.set(hero, 'x', 8);
    tracker.set(hero, 'alpha', 0.75);
    tracker.set(npc, 'x', 10);

    expect(tracker.collectDirty().map((record) => record.id)).toEqual(['hero']);
    expect(tracker.syncOnlyDirty()).toMatchObject({ dirtyCount: 1, syncedProperties: 2 });
    expect(synced).toEqual([{ id: 'hero', properties: ['x', 'alpha'] }]);
    expect(tracker.syncOnlyDirty()).toMatchObject({ dirtyCount: 0, syncedProperties: 0 });
  });

  it('loads critical assets first and pushes lazy decode/upload to background flushes', async () => {
    const pipeline = OmniCore.createAsyncAssetPipeline({
      decodeAsset: async (asset) => ({ ...asset, decoded: true }),
      uploadAsset: async (asset) => ({ ...asset, uploaded: true })
    });

    const firstFrame = await pipeline.loadFrame([
      { id: 'hero', url: 'hero.png', critical: true },
      { id: 'city-bg', url: 'city.png', lazy: true }
    ], { firstFrameBudget: 1 });
    const background = await pipeline.flushBackground();

    expect(firstFrame.ready.map((asset) => asset.id)).toEqual(['hero']);
    expect(firstFrame.deferred.map((asset) => asset.id)).toEqual(['city-bg']);
    expect(background.map((asset) => asset.id)).toEqual(['city-bg']);
    expect(pipeline.report()).toMatchObject({
      decoded: 2,
      uploaded: 2,
      pending: 0
    });
  });

  it('reports incremental spatial index cell moves instead of full rebuilds', () => {
    const index = new EntitySpatialIndex({ cellSize: 10 });
    const enemy = { id: 'enemy', x: 1, y: 1 };

    index.add(enemy);
    enemy.x = 25;
    enemy.y = 25;

    const report = OmniCore.createIncrementalSpatialIndexReport(index);
    expect(report.mode).toBe('incremental');
    expect(report.entities).toBe(1);
    expect(report.incrementalUpdates).toBe(2);
    expect(index.inRadius(25, 25, 5).map((entity) => entity.id)).toEqual(['enemy']);
  });

  it('dispatches pathfinding and collision jobs through worker lanes with fallback evidence', async () => {
    const scheduler = new OmniCore.WorkerTaskScheduler({
      workerManager: new WorkerManager({ workerFactory: null }).registerBuiltins()
    });

    const path = await scheduler.dispatch('pathfinding', {
      start: { x: 0, y: 0 },
      goal: { x: 2, y: 0 },
      grid: [[0, 0, 0]]
    });
    const collisions = await scheduler.dispatch('collision', {
      rects: [
        { id: 'a', x: 0, y: 0, width: 10, height: 10 },
        { id: 'b', x: 5, y: 5, width: 10, height: 10 }
      ]
    });

    expect(path).toMatchObject({
      task: 'pathfinding',
      lane: 'logic',
      offMainThread: false
    });
    expect(path.value).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
    expect(collisions.value).toEqual([{ a: 'a', b: 'b' }]);
    expect(scheduler.plan(['pathfinding', 'collision', 'resource', 'ai']).lanes.map((lane) => lane.name)).toEqual([
      'logic',
      'physics',
      'loading',
      'ai'
    ]);
  });

  it('creates an adaptive texture budget plan for memory and FPS pressure', () => {
    const plan = OmniCore.createTextureBudgetPlan({
      memoryMB: 128,
      textureBytes: 96 * 1024 * 1024,
      fps: 42,
      targetFps: 60,
      activeTextures: 128
    });

    expect(plan.textureScale).toBeLessThan(1);
    expect(plan.particleScale).toBeLessThan(1);
    expect(plan.filterQuality).toBe('low');
    expect(plan.reasons).toEqual(expect.arrayContaining(['memory-pressure', 'fps-pressure', 'texture-count-pressure']));
  });

  it('plans visible tile chunks, preloads neighbors, and unloads distant chunks', () => {
    const plan = OmniCore.createTilemapChunkStreamPlan({
      viewport: { x: 0, y: 0, width: 64, height: 64 },
      chunkSize: 32,
      loadedChunks: ['0,0', '5,5'],
      preloadRadius: 1,
      mapWidth: 6,
      mapHeight: 6
    });

    expect(plan.keep).toEqual(expect.arrayContaining(['0,0']));
    expect(plan.load).toEqual(expect.arrayContaining(['1,0', '0,1', '1,1', '2,2']));
    expect(plan.unload).toEqual(['5,5']);
  });

  it('builds animation LOD sampling plans for near, far, and offscreen actors', () => {
    const plan = OmniCore.createAnimationLODPlan([
      { id: 'hero', distance: 32, visible: true, hasFFD: true },
      { id: 'npc', distance: 420, visible: true, hasFFD: true },
      { id: 'bird', distance: 900, visible: true },
      { id: 'cloud', distance: 80, visible: false }
    ], {
      nearDistance: 128,
      farDistance: 512
    });

    expect(plan.items.find((item) => item.id === 'hero')).toMatchObject({
      sampleRate: 1,
      ffd: true,
      paused: false
    });
    expect(plan.items.find((item) => item.id === 'npc')).toMatchObject({
      sampleRate: 0.5,
      ffd: false,
      paused: false
    });
    expect(plan.items.find((item) => item.id === 'bird')).toMatchObject({
      sampleRate: 0.25,
      paused: false
    });
    expect(plan.items.find((item) => item.id === 'cloud')).toMatchObject({
      sampleRate: 0,
      paused: true
    });
  });

  it('exposes WebGPU instancing, texture-array, and compute dispatch descriptors', () => {
    const instances = OmniCore.createWebGPUInstancingDescriptor({
      instances: [
        { x: 0, y: 0, width: 16, height: 16 },
        { x: 16, y: 0, width: 16, height: 16 },
        { x: 32, y: 0, width: 16, height: 16 }
      ]
    });
    const textureArray = OmniCore.createWebGPUTextureArrayBatch([
      { id: 'a', texture: 'hero.png' },
      { id: 'b', texture: 'props.png' },
      { id: 'c', texture: 'hero.png' }
    ]);
    const compute = OmniCore.createWebGPUComputeDispatchPlan({
      task: 'particles',
      items: 1000,
      workgroupSize: 64
    });

    expect(instances).toMatchObject({
      instanceCount: 3,
      drawCalls: 1,
      stepMode: 'instance'
    });
    expect(textureArray.layers.map((layer) => layer.texture)).toEqual(['hero.png', 'props.png']);
    expect(textureArray.drawCalls).toBe(1);
    expect(compute).toMatchObject({
      task: 'particles',
      workgroups: 16,
      main: 'cs_main'
    });
  });
});
