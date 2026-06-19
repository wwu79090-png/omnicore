import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';
import {
  Loader,
  PhysicsWorld,
  PixiBatchAdapter,
  SleepWakeSystem,
  Tilemap,
  WebGPURenderer
} from '../src/index.js';
import { buildGPUBatches } from '../src/renderer/WebGPURenderer.js';
import ChunkManager from '../src/tilemap/ChunkManager.js';

describe('OmniCore five-dimension 95+ engine hardening', () => {
  let temp = null;

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('keeps 1200-entity scenes under dual spatial indexing, 5-second sleep, and merged render submission', async () => {
    const { default: OmniCore, DualSpatialIndex } = await import('../src/index.js');
    const index = new DualSpatialIndex({ worldWidth: 4096, worldHeight: 4096, cellSize: 32 });
    const staticEntities = Array.from({ length: 800 }, (_, item) => ({
      id: `wall-${item}`,
      x: (item % 40) * 32,
      y: Math.floor(item / 40) * 32,
      width: 16,
      height: 16
    }));
    const dynamicEntities = Array.from({ length: 400 }, (_, item) => ({
      id: `enemy-${item}`,
      x: (item % 20) * 24,
      y: Math.floor(item / 20) * 24,
      width: 12,
      height: 12
    }));
    staticEntities.forEach((entity) => index.addStatic(entity));
    dynamicEntities.forEach((entity) => index.addDynamic(entity));

    const sleep = vi.fn();
    const sleepable = { id: 'crate', sleepable: true, x: 4, y: 4, sleep };
    new SleepWakeSystem({ stillnessMs: 5000 }).updatePhysicsStillness(sleepable, 5001);
    const adapter = new PixiBatchAdapter({ capacity: 1300, forceBatchThreshold: 200 });
    for (let item = 0; item < 1200; item += 1) {
      adapter.drawSprite({ texture: `tex-${item % 8}`, x: item, y: 0, width: 8, height: 8 });
    }
    const gpuBatches = buildGPUBatches(Array.from({ length: 1200 }, (_, item) => ({
      texture: `tex-${item % 24}`,
      material: `mat-${item % 3}`,
      blendMode: 'normal',
      x: item,
      y: 0,
      width: 8,
      height: 8
    })), { maxBatches: 5 });

    expect(OmniCore.DualSpatialIndex).toBe(DualSpatialIndex);
    expect(index.stats()).toMatchObject({
      staticStructure: 'quadtree',
      dynamicStructure: 'spatial-hash',
      staticCount: 800,
      dynamicCount: 400
    });
    expect(index.query({ x: 0, y: 0, width: 160, height: 160 }).length).toBeGreaterThan(0);
    expect(sleep).toHaveBeenCalledOnce();
    expect(sleepable.sleeping).toBe(true);
    expect(adapter.forceBatchFlushNeeded()).toBe(true);
    expect(gpuBatches).toHaveLength(5);
    expect(gpuBatches[0]).toMatchObject({ type: 'batch', count: expect.any(Number) });
  });

  it('shares 1200 entity positions through SharedArrayBuffer and isolates worker tasks over 50ms', async () => {
    const { TaskScheduler } = await import('../src/index.js');
    const renderer = new WebGPURenderer();
    const buffer = renderer.mapEntityBuffer(Array.from({ length: 1200 }, (_, item) => ({
      x: item,
      y: item + 1,
      width: 16,
      height: 16
    })));
    let now = 0;
    const scheduler = new TaskScheduler({ timeoutMs: 50, now: () => now });
    scheduler.submit(() => {
      now += 12;
      return 'fast';
    }, { name: 'atlas-hash' });
    scheduler.submit(() => {
      now += 61;
      return 'slow';
    }, { name: 'chunk-load' });

    const results = await scheduler.waitAll();

    expect(buffer.count).toBe(1200);
    expect(buffer.bytes).toBe(1200 * 8 * Float32Array.BYTES_PER_ELEMENT);
    expect(buffer.shared).toBe(typeof SharedArrayBuffer !== 'undefined');
    expect(results).toEqual([
      expect.objectContaining({ name: 'atlas-hash', status: 'fulfilled', value: 'fast', isolated: false }),
      expect.objectContaining({ name: 'chunk-load', status: 'fulfilled', value: 'slow', isolated: true })
    ]);
    expect(scheduler.isolatedTasks).toHaveLength(1);
    expect(scheduler.isolatedTasks[0]).toMatchObject({ name: 'chunk-load', durationMs: 61 });
  });

  it('runs changed-file-only atlas builds, rewrites scene textures, and falls back when WebP is unsupported', async () => {
    const incrementalAssetBuildPath = pathToFileURL(path.resolve('scripts/incremental-asset-build.js')).href;
    const { runIncrementalAssetBuild } = await import(/* @vite-ignore */ incrementalAssetBuildPath);
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-five95-assets-'));
    const assetsDir = path.join(temp, 'assets');
    const scenesDir = path.join(temp, 'scenes');
    const outDir = path.join(temp, 'dist');
    mkdirSync(path.join(assetsDir, 'sprites'), { recursive: true });
    mkdirSync(scenesDir, { recursive: true });
    writeFileSync(path.join(assetsDir, 'sprites', 'hero.png'), 'hero-bytes');
    writeFileSync(path.join(assetsDir, 'sprites', 'enemy.png'), 'enemy-bytes');
    writeFileSync(path.join(scenesDir, 'level.json'), JSON.stringify({
      entities: [
        { id: 'hero', texture: 'assets/sprites/hero.png' },
        { id: 'bg', texture: 'assets/sprites/missing.png' }
      ]
    }, null, 2));

    const report = await runIncrementalAssetBuild({
      assetsDir,
      scenesDir,
      outDir,
      changedFiles: ['sprites/hero.png']
    });
    const rewrittenScene = JSON.parse(readFileSync(path.join(outDir, 'scenes', 'level.json'), 'utf8'));
    const loaderCalls = [];
    const loader = new Loader({
      webpSupport: false,
      fetcher: async (url) => {
        loaderCalls.push(url);
        return { ok: true, text: async () => `loaded:${url}` };
      }
    });
    const loaded = await loader.loadBundle([{ key: 'hero', url: '/assets/hero.png', type: 'text' }]);

    expect(report).toMatchObject({
      incremental: true,
      changedCount: 1,
      processedFiles: ['sprites/hero.png'],
      targetMs: 200
    });
    expect(report.durationMs).toBeLessThanOrEqual(200);
    expect(report.atlases[0].frames).toContain('hero.png');
    expect(report.atlases[0].frames).not.toContain('enemy.png');
    expect(rewrittenScene.entities[0].texture).toContain('atlases/incremental.atlas.json#hero.png');
    expect(rewrittenScene.entities[1].texture).toBe('assets/sprites/missing.png');
    expect(loaderCalls).toEqual(['/assets/hero.png']);
    expect(loaded.hero).toBe('loaded:/assets/hero.png');
  });

  it('supports editor asset library, snapped prefab placement, collision drag paint, snapshots, and Undo/Redo', async () => {
    const { createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href);
    const root = document.createElement('main');
    document.body.appendChild(root);
    const messages = [];
    const api = createEditorApp(root, {
      state: {
        collisionMode: true,
        assets: ['assets/sprites/hero.png'],
        scene: { entities: [{ id: 'hero', name: 'Hero', x: 0, y: 0, width: 16, height: 16 }] },
        prefabs: [{ id: 'coin', name: 'Coin', texture: 'coin.png', width: 16, height: 16 }],
        tilemap: { width: 3, height: 1, tileWidth: 16, tileHeight: 16, data: [0, 0, 0], collisions: [] }
      },
      transport: { send: (message) => messages.push(JSON.parse(message)) }
    });
    root.querySelector('[data-editor-entity-id="hero"]').click();
    const xInput = root.querySelector('[data-inspector-field="x"]');
    xInput.value = '48';
    xInput.dispatchEvent(new Event('input', { bubbles: true }));
    api.undo();
    api.redo();

    const firstCell = root.querySelector('[data-tile-index="0"]');
    const secondCell = root.querySelector('[data-tile-index="1"]');
    firstCell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    secondCell.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    const dropZone = root.querySelector('[data-scene-drop-zone="true"]');
    dropZone.getBoundingClientRect = () => ({ left: 0, top: 0 });
    dropZone.dispatchEvent(createDropEvent('drop', 'coin', { clientX: 31, clientY: 33 }));
    const snapshot = api.saveSnapshot('level-1');
    const tiled = api.exportTiledJson();

    expect(root.querySelector('[data-editor-asset-path="assets/sprites/hero.png"]')).toBeTruthy();
    expect(api.getState().scene.entities.find((entity) => entity.id === 'hero').x).toBe(48);
    expect(api.getState().tilemap.collisions).toEqual(expect.arrayContaining([0, 1]));
    expect(api.getState().scene.entities.find((entity) => entity.prefabId === 'coin')).toMatchObject({
      x: 32,
      y: 32
    });
    expect(snapshot).toMatchObject({
      name: 'level-1',
      version: 1,
      scene: expect.objectContaining({ entities: expect.any(Array) })
    });
    expect(tiled.layers[1].objects).toHaveLength(2);
    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'editor:save-snapshot' })
    ]));
  });

  it('streams infinite tile chunks and bakes static collision binaries for direct physics loading', async () => {
    const collisionBakePath = pathToFileURL(path.resolve('scripts/bake-tilemap-collisions.js')).href;
    const { bakeTilemapCollisionFiles } = await import(/* @vite-ignore */ collisionBakePath);
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-five95-tilemap-'));
    const mapsDir = path.join(temp, 'maps');
    const outDir = path.join(temp, 'baked');
    mkdirSync(mapsDir, { recursive: true });
    writeFileSync(path.join(mapsDir, 'world.json'), JSON.stringify({
      width: 4,
      height: 2,
      tilewidth: 16,
      tileheight: 16,
      layers: [{
        name: 'collision',
        type: 'tilelayer',
        width: 4,
        height: 2,
        data: [1, 1, 1, 1, 0, 0, 1, 1],
        properties: [{ name: 'collision', value: true }]
      }]
    }, null, 2));
    const report = bakeTilemapCollisionFiles({ source: mapsDir, outDir });
    const binaryFile = path.join(outDir, 'world.collision.bin');
    const binary = readFileSync(binaryFile);
    const decoded = Tilemap.readCollisionBinary(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength));
    const physics = new PhysicsWorld();
    const physicsReport = physics.loadStaticCollisionBinary(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength));
    const chunks = new ChunkManager(createInfiniteTilemap(), {
      mode: 'infinite',
      chunkPixelSize: 16,
      unloadDistance: 5
    });
    chunks.updateAroundPlayer({ x: 0, y: 0 });
    chunks.updateAroundPlayer({ x: 64, y: 0 });
    chunks.updateAroundPlayer({ x: 160, y: 0 });

    expect(report).toMatchObject({ baked: 1, files: [expect.stringContaining('world.collision.bin')] });
    expect(existsSync(binaryFile)).toBe(true);
    expect(decoded.polygons.length).toBeLessThan(6);
    expect(physicsReport).toMatchObject({
      colliderSource: 'binary-polygons',
      bodyCount: 0,
      physicsMsBudget: 0.5
    });
    expect(chunks.updateAroundPlayer({ x: 176, y: 0 })).toHaveLength(9);
    expect([...chunks.activeChunks.values()].every((chunk) => Math.abs(chunk.x - 11) <= 5)).toBe(true);
  });
});

function createDropEvent(type, prefabId, coordinates = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clientX', { value: coordinates.clientX ?? 0 });
  Object.defineProperty(event, 'clientY', { value: coordinates.clientY ?? 0 });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      getData: (format) => (format === 'application/x-omnicore-prefab' || format === 'text/plain' ? prefabId : ''),
      setData() {}
    }
  });
  return event;
}

function createInfiniteTilemap() {
  return {
    tileWidth: 16,
    tileHeight: 16,
    layers: [{
      name: 'infinite',
      type: 'tilelayer',
      width: 1,
      height: 1,
      data: [0]
    }]
  };
}
