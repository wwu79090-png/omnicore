import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, afterEach } from 'vitest';
import {
  EventBus,
  EventSheet,
  PhysicsWorld,
  RendererManager,
  SleepWakeSystem,
  Tilemap,
  WebGPURenderer
} from '../src/index.js';
import ChunkManager from '../src/tilemap/ChunkManager.js';
import { createAssetWatchServer } from '../scripts/asset-watch-server.js';

describe('OmniCore 2D extreme runtime constraints', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps WebGPU as the default backend and submits at most 5 GPU batch commands through the worker', async () => {
    const posted = [];
    const renderer = await new WebGPURenderer({
      canvas: createWebGPUCanvas(),
      gpu: createFakeGPU(),
      workerFactory: () => ({
        postMessage(message) {
          posted.push(message);
        },
        terminate() {}
      })
    }).init();
    const scene = {
      children: Array.from({ length: 1000 }, (_, index) => ({
        id: `sprite-${index}`,
        type: 'sprite',
        texture: `atlas-${index % 20}`,
        material: `mat-${index % 3}`,
        x: index,
        y: index,
        width: 8,
        height: 8
      }))
    };

    renderer.renderScene(scene);
    const frame = posted.findLast((message) => message.type === 'frame');

    expect(new RendererManager().fallbackOrder.slice(0, 2)).toEqual(['webgpu', 'webgl']);
    expect(frame.pipelineOwner).toBe('worker');
    expect(frame.instructions).toHaveLength(5);
    expect(frame.batchCount).toBeLessThanOrEqual(5);
    expect(frame.entityCount).toBe(1000);
  });

  it('streams an infinite chunk map in a 3x3 window and unloads chunks farther than 5 cells', () => {
    const manager = new ChunkManager(createInfiniteTilemap(), {
      mode: 'infinite',
      chunkPixelSize: 16,
      unloadDistance: 5
    });

    const first = manager.updateAroundPlayer({ x: 8, y: 8 });
    const second = manager.updateAroundPlayer({ x: 160, y: 0 });

    expect(first).toHaveLength(9);
    expect(first.map((chunk) => chunk.key)).toEqual(expect.arrayContaining(['infinite:0:0', 'infinite:1:1']));
    expect(second).toHaveLength(9);
    expect([...manager.activeChunks.keys()]).not.toContain('infinite:0:0');
  });

  it('sleeps and wakes entities by player distance with a 50px gameplay radius', () => {
    const enemy = { id: 'slime', kind: 'enemy', x: 80, y: 0 };
    const system = new SleepWakeSystem({ player: { x: 0, y: 0 }, distance: 50, wakeDistance: 50 });

    expect(system.updateDistanceActivity(enemy)).toBe(false);
    expect(enemy.active).toBe(false);
    enemy.x = 12;
    expect(system.updateDistanceActivity(enemy)).toBe(true);
    expect(enemy.active).toBe(true);
  });

  it('splits event queues over 100 entries into timestamped 10-event frames', () => {
    const handled = [];
    const bus = new EventBus({ overflowThreshold: 100, microbatchSize: 10 });
    bus.on('hit', (payload) => handled.push(payload.index));

    for (let index = 0; index < 105; index += 1) {
      bus.queueEvent('hit', { index }, { timestamp: index });
    }

    expect(bus.pendingEventCount()).toBe(105);
    expect(bus.processEventFrame()).toBe(10);
    expect(handled).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(bus.pendingEventCount()).toBe(95);
  });

  it('exposes compiled condition ASTs and native functions for EventSheet conditions', () => {
    const sheet = EventSheet.parse({
      events: [{
        conditions: [{ op: 'gte', left: 'state.score', right: 10 }],
        actions: [{ op: 'set', target: 'state.win', value: true }]
      }]
    }, { compile: true });
    const runtime = { state: { score: 12, win: false } };

    sheet.run(runtime);

    expect(runtime.state.win).toBe(true);
    expect(sheet.conditionAst).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'gte', left: 'state.score', right: 10 })
    ]));
    expect(sheet.compiledConditionFunctions).toHaveLength(1);
  });

  it('bakes tilemap collision polygons into a compact binary buffer', () => {
    const binary = Tilemap.bakeCollisionBinary({
      width: 3,
      height: 2,
      tileWidth: 16,
      tileHeight: 16,
      data: [1, 1, 0, 0, 1, 1],
      collisionTileIds: [1]
    });
    const decoded = Tilemap.readCollisionBinary(binary);

    expect(binary).toBeInstanceOf(ArrayBuffer);
    expect(decoded.polygons).toEqual([
      { x: 0, y: 0, width: 32, height: 16 },
      { x: 16, y: 16, width: 32, height: 16 }
    ]);
  });

  it('expands the physics world bounds when the player crosses current limits', () => {
    const world = new PhysicsWorld({ bounds: { minX: 0, minY: 0, maxX: 64, maxY: 64 } });

    const bounds = world.ensurePlayerBounds({ x: 120, y: -20 }, { padding: 32 });

    expect(bounds).toMatchObject({ minY: -52, maxX: 152 });
    expect(world.containsPoint({ x: 120, y: -20 })).toBe(true);
  });

  it('reports sub-200ms incremental asset builds and applies WebSocket HMR resource patches', async () => {
    const payloads = [];
    const server = createAssetWatchServer({
      source: 'assets',
      converter: (files) => files.map((file) => ({ file, output: `${file}.packed`, hash: 'h1' })),
      websocket: { send: (payload) => payloads.push(JSON.parse(payload)) }
    });
    server.recordChange('hero.png');
    const report = await server.flushPending();
    const hmrClientPath = '../src/assets/ResourceHMRClient.js';
    const { ResourceHMRClient } = await import(/* @vite-ignore */ hmrClientPath);
    const applied = [];
    const client = new ResourceHMRClient({
      patchManager: { apply: async (patch) => applied.push(patch) }
    });
    client.accept(JSON.stringify({
      type: 'assets:hot-update',
      files: ['hero.png'],
      conversions: [{ file: 'hero.png', output: 'hero.png.packed' }]
    }));

    expect(report.incremental).toBe(true);
    expect(report.targetMs).toBe(200);
    expect(report.changedCount).toBe(1);
    expect(payloads[0]).toMatchObject({ type: 'assets:hot-update' });
    expect(applied[0]).toMatchObject({ files: { 'hero.png': expect.any(Object) } });
  });

  it('links editor entity selection to runtime highlight messages and visible scene highlights', async () => {
    const { createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href);
    const root = document.createElement('main');
    const sent = [];
    document.body.appendChild(root);
    createEditorApp(root, {
      state: {
        scene: { entities: [{ id: 'hero', name: 'Hero', x: 16, y: 16 }] }
      },
      transport: { send: (message) => sent.push(JSON.parse(message)) }
    });

    root.querySelector('[data-editor-entity-id="hero"]').click();

    expect(root.querySelector('[data-scene-node-id="hero"]').className).toContain('selected');
    expect(sent).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'editor:highlight-entity', payload: { id: 'hero' } })
    ]));
  });
});

function createWebGPUCanvas() {
  return {
    transferControlToOffscreen: () => ({ kind: 'offscreen' }),
    getContext: (type) => (type === 'webgpu' ? { configure() {} } : null)
  };
}

function createFakeGPU() {
  return {
    getPreferredCanvasFormat: () => 'bgra8unorm',
    requestAdapter: async () => ({
      requestDevice: async () => ({
        createShaderModule: (descriptor) => descriptor,
        createRenderPipeline: (descriptor) => descriptor,
        queue: { submit() {} }
      })
    })
  };
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
