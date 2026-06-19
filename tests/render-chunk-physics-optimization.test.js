import { describe, expect, it, vi } from 'vitest';
import PhysicsAddon from '../src/lean/addons/Physics.js';
import PhysicsWorld from '../src/physics/PhysicsWorld.js';
import PixiRenderer from '../src/renderer/PixiRenderer.js';
import { Scene, Sprite } from '../src/scene/Scene.js';
import Store from '../src/store/Store.js';
import Tilemap from '../src/tilemap/Tilemap.js';

describe('Pixi batch rendering optimization', () => {
  it('merges one thousand same-atlas Pixi sprites into one estimated draw call', () => {
    const store = new Store();
    const renderer = new PixiRenderer({ store });
    renderer.stage = fakeStage();
    renderer.app = { stage: renderer.stage, renderer: { render: vi.fn() } };
    const scene = new Scene('batch');

    for (let index = 0; index < 1000; index += 1) {
      scene.add(new Sprite('atlas://terrain', {
        x: (index % 50) * 16,
        y: Math.floor(index / 50) * 16,
        width: 16,
        height: 16
      }));
    }

    renderer.renderScene(scene);

    expect(renderer.batchStats).toEqual(expect.objectContaining({
      drawCalls: 1,
      spriteCount: 1000,
      batchCount: 1,
      fpsTarget: 60
    }));
    expect(store.get('renderer:drawCalls')).toBe(1);
  });

  it('precompiles repeated static sprites into one immutable build-time batch manifest', async () => {
    const { StaticBatchCompiler } = await import('../src/index.js');
    expect(typeof StaticBatchCompiler).toBe('function');

    const scene = {
      name: 'forest',
      entities: Array.from({ length: 1000 }, (_, index) => ({
        id: `tree-${index}`,
        type: 'sprite',
        texture: 'atlas://trees',
        static: true,
        x: (index % 50) * 16,
        y: Math.floor(index / 50) * 16,
        width: 16,
        height: 16
      }))
    };

    const manifest = StaticBatchCompiler.compileScene(scene, {
      scenePath: 'examples/forest/scene.json'
    });

    expect(manifest).toMatchObject({
      scene: 'forest',
      source: 'examples/forest/scene.json',
      drawCallsBefore: 1000,
      drawCallsAfter: 1,
      savedDrawCalls: 999
    });
    expect(manifest.batches).toHaveLength(1);
    expect(manifest.batches[0]).toMatchObject({
      key: 'atlas://trees|normal|batch',
      texture: 'atlas://trees',
      static: true,
      immutable: true,
      spriteCount: 1000
    });
    expect(manifest.batches[0].vertices).toHaveLength(1000 * 4);
  });
});

describe('Tilemap chunk memory unloading', () => {
  it('loads only viewport chunks for a 100x100 map and unloads offscreen tile data', () => {
    const tilemap = Tilemap.parse({
      width: 100,
      height: 100,
      tilewidth: 16,
      tileheight: 16,
      layers: [
        {
          id: 1,
          name: 'Ground',
          type: 'tilelayer',
          width: 100,
          height: 100,
          data: Array(10000).fill(1)
        }
      ]
    });
    const manager = tilemap.createChunkManager({
      chunkPixelSize: 160,
      unloadDistance: 0,
      collisionTileIds: [1]
    });

    const first = manager.update({ x: 0, y: 0, width: 160, height: 160 });
    const firstChunk = first[0];

    expect(first).toHaveLength(1);
    expect(firstChunk.data).toHaveLength(100);
    expect(manager.getRenderableTiles()).toHaveLength(100);
    expect(manager.getCollisionObjects()).toHaveLength(100);
    expect(manager.estimateMemoryBytes()).toBeLessThan(50 * 1024 * 1024);

    const second = manager.update({ x: 1440, y: 1440, width: 160, height: 160 });

    expect(second).toHaveLength(1);
    expect(firstChunk.data).toBeNull();
    expect(firstChunk.disabled).toBe(true);
    expect(manager.getRenderableTiles()).toHaveLength(100);
    expect(manager.getCollisionObjects()).toHaveLength(100);
    expect(manager.estimateMemoryBytes()).toBeLessThan(50 * 1024 * 1024);
  });
});

describe('Physics query scans', () => {
  it('queries entities in front of the player with raycast and circle scans', () => {
    const physics = new PhysicsAddon({ matter: fakeMatter() }).mount();
    const enemyA = { id: 'enemy-a', x: 16, y: 0, width: 16, height: 16 };
    const enemyB = { id: 'enemy-b', x: 40, y: 0, width: 16, height: 16 };
    const farEnemy = { id: 'enemy-far', x: 80, y: 0, width: 16, height: 16 };

    physics.attachBody(enemyA);
    physics.attachBody(enemyB);
    physics.attachBody(farEnemy);

    expect(physics.query.raycast(0, 8, 16 * 3, 8)).toEqual([enemyA, enemyB]);
    expect(physics.query.circle(24, 8, 28)).toEqual([enemyA, enemyB]);

    const world = new PhysicsWorld({ engine: physics.engine });
    expect(world.query.raycast(0, 8, 16 * 3, 8)).toEqual([enemyA, enemyB]);
    expect(world.query.circle(24, 8, 28)).toEqual([enemyA, enemyB]);
  });
});

function fakeStage() {
  const stage = {
    children: [],
    addChild: vi.fn((child) => {
      if (!stage.children.includes(child)) stage.children.push(child);
      child.parent = stage;
      return child;
    }),
    removeChild: vi.fn((child) => {
      stage.children = stage.children.filter((item) => item !== child);
      child.parent = null;
      return child;
    }),
    setChildIndex: vi.fn((child, index) => {
      stage.children = stage.children.filter((item) => item !== child);
      stage.children.splice(index, 0, child);
    })
  };
  return stage;
}

function fakeMatter() {
  return {
    Engine: {
      create: () => ({ world: { bodies: [] } }),
      update: vi.fn()
    },
    Bodies: {
      rectangle: vi.fn((x, y, width, height, options = {}) => ({
        position: { x, y },
        width,
        height,
        bounds: {
          min: { x: x - width / 2, y: y - height / 2 },
          max: { x: x + width / 2, y: y + height / 2 }
        },
        ...options
      }))
    },
    Composite: {
      add: vi.fn((world, body) => {
        world.bodies.push(body);
      })
    },
    Events: { on: vi.fn() }
  };
}
