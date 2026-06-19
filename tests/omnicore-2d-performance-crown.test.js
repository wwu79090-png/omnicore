import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  EventBus,
  EventSheet,
  RendererManager,
  SleepWakeSystem,
  Tilemap,
  WebGPURenderer
} from '../src/index.js';

describe('OmniCore 2D performance crown', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
    document.body.innerHTML = '';
  });

  it('uses native WebGPU 2D pipeline, zero-copy entity buffers, and worker-owned OffscreenCanvas frames', async () => {
    const posted = [];
    const canvas = createWebGPUCanvas();
    const renderer = await new WebGPURenderer({
      canvas,
      gpu: createFakeGPU(),
      workerFactory: () => ({
        postMessage(message) {
          posted.push(message);
        },
        terminate() {}
      })
    }).init();

    const mapped = renderer.mapEntityBuffer([
      { x: 1, y: 2, width: 3, height: 4, color: '#ff0000' },
      { x: 5, y: 6, width: 7, height: 8, color: '#00ff00' }
    ]);
    renderer.renderScene({ children: [{ id: 'hero', x: 1, y: 2, width: 3, height: 4 }] });

    expect(renderer.pipelineDescriptor.shaderLanguage).toBe('wgsl');
    expect(JSON.stringify(renderer.pipelineDescriptor)).not.toMatch(/glsl/i);
    expect(mapped.shared).toBe(true);
    expect(mapped.float32).toBeInstanceOf(Float32Array);
    expect(mapped.float32.slice(0, 4)).toEqual(new Float32Array([1, 2, 3, 4]));
    expect(posted).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'init', ownsCanvas: true, backend: 'webgpu' }),
      expect.objectContaining({ type: 'frame', buffer: mapped.buffer, commandSource: 'worker' })
    ]));
  });

  it('keeps renderer selection WebGPU-first with WebGL/canvas fallback and no Pixi default path', () => {
    const manager = new RendererManager();

    expect(manager.fallbackOrder).toEqual(['webgpu', 'webgl', 'canvas']);
    expect(manager.fallbackOrder).not.toContain('pixi');
  });

  it('indexes static and dynamic entities with quadtree plus spatial hash for million-tile worlds', async () => {
    const { DualSpatialIndex } = await importFile('src/core/DualSpatialIndex.js');
    const index = new DualSpatialIndex({ worldWidth: 1000 * 16, worldHeight: 1000 * 16, cellSize: 32 });
    index.addStatic({ id: 'wall', x: 160, y: 160, width: 32, height: 32 });
    index.addDynamic({ id: 'enemy', x: 170, y: 170, width: 16, height: 16 });

    const hits = index.query({ x: 150, y: 150, width: 96, height: 96 });

    expect(hits.map((item) => item.id)).toEqual(expect.arrayContaining(['wall', 'enemy']));
    expect(index.stats()).toMatchObject({
      staticStructure: 'quadtree',
      dynamicStructure: 'spatial-hash',
      worldTiles: 1000000
    });
  });

  it('sleeps still physics bodies after 5 seconds and suppresses EventBus floods into microbatches', () => {
    const slept = [];
    const system = new SleepWakeSystem({ enabled: true, stillnessMs: 5000, onSleep: (entity) => slept.push(entity.id) });
    const body = { id: 'crate', x: 10, y: 10, vx: 0, vy: 0, sleep: () => { body.sleepCalled = true; } };

    system.updatePhysicsStillness(body, 2500);
    system.updatePhysicsStillness(body, 2600);

    expect(body.sleeping).toBe(true);
    expect(body.sleepCalled).toBe(true);
    expect(slept).toEqual(['crate']);

    const events = [];
    const bus = new EventBus({ frameEventLimit: 50 });
    bus.on('hit', (payload) => events.push(payload.index));
    for (let index = 0; index < 55; index += 1) bus.emit('hit', { index });

    expect(events).toHaveLength(50);
    expect(bus.pendingMicrobatchCount()).toBe(5);
    bus.flushMicrobatches();
    expect(events).toHaveLength(55);
  });

  it('streams neighboring tile chunks in a worker and bakes static tile collisions into merged polygons', async () => {
    const posted = [];
    const streamer = new Tilemap.Streamer({
      chunkSize: 16,
      workerFactory: () => ({
        postMessage(message) {
          posted.push(message);
        },
        terminate() {}
      })
    });
    const scheduled = streamer.prefetchAround({ chunkX: 5, chunkY: 6 }, { radius: 1 });
    const baked = Tilemap.bakeStaticCollision({
      width: 4,
      height: 2,
      tileWidth: 16,
      tileHeight: 16,
      data: [1, 1, 0, 0, 1, 1, 0, 1],
      collisionTileIds: [1]
    });

    expect(scheduled).toHaveLength(9);
    expect(posted[0]).toMatchObject({ type: 'prefetch', chunks: expect.any(Array) });
    expect(baked.polygons).toEqual(expect.arrayContaining([
      expect.objectContaining({ x: 0, y: 0, width: 32, height: 32, mergedTiles: 4 }),
      expect.objectContaining({ x: 48, y: 16, width: 16, height: 16, mergedTiles: 1 })
    ]));
    expect(baked.colliderCount).toBeLessThan(5);
  });

  it('compiles EventSheet conditions to cached native Functions', () => {
    const sheet = EventSheet.parse({
      events: [{
        conditions: [{ op: 'equals', left: 'state.score', right: 3 }],
        actions: [{ op: 'set', target: 'state.win', value: true }]
      }]
    }, { compile: true });
    const runtime = { state: { score: 3, win: false } };

    sheet.run(runtime);

    expect(runtime.state.win).toBe(true);
    expect(sheet.compiledNativeFunctions).toBeGreaterThan(0);
    expect(sheet.compilationCacheKey).toContain('equals');
  });

  it('debounces source asset changes within 100ms, hot-pushes over WebSocket, and creates OTA patch files', async () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-2d-assets-'));
    const { createAssetWatchServer } = await importFile('scripts/asset-watch-server.js');
    const { createPatch } = await importFile('scripts/ota-patch.js');
    const pushed = [];
    const server = createAssetWatchServer({
      source: temp,
      debounceMs: 100,
      converter: (files) => files.map((file) => ({ file, output: file.replace(/\.png$/u, '.webp') })),
      websocket: { send: (payload) => pushed.push(JSON.parse(payload)) }
    });

    server.recordChange('hero.png');
    server.recordChange('enemy.png');
    await server.flushPending();

    mkdirSync(path.join(temp, 'old'), { recursive: true });
    mkdirSync(path.join(temp, 'next'), { recursive: true });
    writeFileSync(path.join(temp, 'old', 'hero.json'), '{"hp":1}');
    writeFileSync(path.join(temp, 'next', 'hero.json'), '{"hp":2}');
    const patch = createPatch({
      fromDir: path.join(temp, 'old'),
      toDir: path.join(temp, 'next'),
      outFile: path.join(temp, 'release.patch')
    });

    expect(server.debounceMs).toBe(100);
    expect(pushed[0]).toMatchObject({ type: 'assets:hot-update', conversions: expect.any(Array) });
    expect(patch.file.endsWith('.patch')).toBe(true);
    expect(patch.changed).toEqual(['hero.json']);
    expect(existsSync(path.join(temp, 'release.patch'))).toBe(true);
  });

  it('enables editor drag simulation and Yjs-compatible collaborative tile and monster edits', async () => {
    const { createEditorApp } = await importFile('packages/omnicore-editor/src/editor-app.js');
    const { createEditorState } = await importFile('packages/omnicore-editor/src/live-sync-protocol.js');
    const { createCollaborationSession } = await importFile('packages/omnicore-editor/src/collaboration.js');
    const root = document.createElement('main');
    const sent = [];
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({ scene: { entities: [{ id: 'hero', name: 'Hero', x: 0, y: 0 }] } }),
      transport: { send: (message) => sent.push(JSON.parse(message)) }
    });

    root.querySelector('[data-scene-node-id="hero"]').dispatchEvent(new MouseEvent('mousedown', { clientX: 1, clientY: 2, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 3, clientY: 4, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const alice = createCollaborationSession({ clientId: 'alice' });
    const bob = createCollaborationSession({ clientId: 'bob' });
    const update = alice.transact((doc) => {
      doc.placeTile({ x: 1, y: 2, tileId: 7 });
      doc.placeMonster({ id: 'slime', x: 3, y: 4 });
    });
    bob.applyUpdate(update);

    expect(app.getState().simulation.active).toBe(false);
    expect(sent).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'editor:simulate-start' }),
      expect.objectContaining({ type: 'editor:simulate-stop' })
    ]));
    expect(update.protocol).toBe('yjs-update-v1');
    expect(bob.snapshot()).toMatchObject({
      tiles: [{ x: 1, y: 2, tileId: 7 }],
      monsters: [{ id: 'slime', x: 3, y: 4 }]
    });
  });

  it('enforces 100 percent core coverage and 10 golden screenshots with 0.1 percent pixel gate', () => {
    const workflow = readFileSync('.github/workflows/pr-quality.yml', 'utf8');
    const visual = readFileSync('scripts/visual-regression.js', 'utf8');
    const golden = JSON.parse(readFileSync('tests/visual/golden/examples.json', 'utf8'));

    expect(workflow).toContain('src/core');
    expect(workflow).toContain('src/renderer');
    expect(workflow).toContain('src/store');
    expect(workflow).toContain('--coverage.thresholds.lines 100');
    expect(visual).toContain('const threshold = 0.001');
    expect(golden.examples).toHaveLength(10);
  });
});

function createWebGPUCanvas() {
  return {
    width: 0,
    height: 0,
    transferControlToOffscreen: () => ({ kind: 'offscreen-canvas' }),
    getContext(type) {
      if (type !== 'webgpu') return null;
      return {
        configure(config) {
          this.config = config;
        }
      };
    }
  };
}

function createFakeGPU() {
  return {
    getPreferredCanvasFormat: () => 'bgra8unorm',
    requestAdapter: async () => ({
      requestDevice: async () => ({
        createShaderModule: (descriptor) => descriptor,
        createRenderPipeline: (descriptor) => descriptor,
        createBuffer: (descriptor) => ({ descriptor }),
        queue: {
          writeBuffer() {},
          submit() {}
        }
      })
    })
  };
}

function importFile(file) {
  return import(/* @vite-ignore */ pathToFileURL(path.resolve(file)).href);
}
