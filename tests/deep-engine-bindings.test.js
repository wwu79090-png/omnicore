import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import EventSheet from '../src/data/EventSheet.js';
import EventBus from '../src/core/EventBus.js';
import PhysicsAddon from '../src/lean/addons/Physics.js';
import PixiRenderer from '../src/renderer/PixiRenderer.js';
import Store from '../src/store/Store.js';
import Tilemap from '../src/tilemap/Tilemap.js';
import TilemapLoader from '../src/tilemap/TilemapLoader.js';
import { Sprite } from '../src/scene/Scene.js';

describe('tilemap chunking and Matter collision binding', () => {
  it('loads Tiled tile layers into 16x16 chunks and returns only viewport-active chunks', async () => {
    const data = Array.from({ length: 32 * 32 }, (_, index) => index + 1);
    const loader = new TilemapLoader({
      fetcher: async () => ({
        ok: true,
        json: async () => ({
          width: 32,
          height: 32,
          tilewidth: 16,
          tileheight: 16,
          layers: [{ id: 1, name: 'Ground', type: 'tilelayer', width: 32, height: 32, data }]
        })
      })
    });

    const map = await loader.load('/maps/large.json');
    const ground = map.getTileLayer('Ground');
    const visible = ground.getVisibleChunks({ x: 0, y: 0, width: 256, height: 256 });

    expect(ground.chunks).toHaveLength(4);
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({ x: 0, y: 0, width: 16, height: 16 });
    expect(visible[0].tileAt(0, 0)).toBe(1);
  });

  it('creates static Matter walls from Tiled objectgroup rectangle collision objects', () => {
    const added = [];
    const Matter = {
      Engine: { create: () => ({ world: { bodies: added } }) },
      Bodies: {
        rectangle: vi.fn((x, y, width, height, options) => ({ x, y, width, height, options }))
      },
      Composite: { add: vi.fn((world, body) => world.bodies.push(body)) },
      Events: { on: vi.fn() }
    };
    const physics = new PhysicsAddon({ matter: Matter }).mount();
    const map = Tilemap.parse({
      width: 8,
      height: 8,
      tilewidth: 16,
      tileheight: 16,
      layers: [
        {
          id: 2,
          name: 'Collisions',
          type: 'objectgroup',
          objects: [{ id: 7, name: 'wall', x: 16, y: 32, width: 64, height: 16 }]
        }
      ]
    });

    const bodies = map.createMatterColliders(physics, 'Collisions');

    expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(48, 40, 64, 16, expect.objectContaining({
      isStatic: true,
      label: 'wall'
    }));
    expect(bodies).toHaveLength(1);
    expect(added).toHaveLength(1);
  });
});

describe('Matter entity lifecycle and collision events', () => {
  it('maps body type, category, mask, and sensor flags into Matter body options', () => {
    const added = [];
    const Matter = {
      Engine: { create: () => ({ world: { bodies: added } }) },
      Bodies: {
        rectangle: vi.fn((x, y, width, height, options) => ({ position: { x, y }, width, height, options }))
      },
      Composite: { add: vi.fn((world, body) => world.bodies.push(body)) },
      Events: { on: vi.fn() }
    };
    const physics = new PhysicsAddon({ matter: Matter }).mount();
    const player = new Sprite('hero', { x: 0, y: 0, width: 20, height: 30 });

    physics.attachBody(player, {
      body: { type: 'dynamic', category: 'player', mask: 'world' },
      sensor: true
    });

    expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(10, 15, 20, 30, expect.objectContaining({
      isStatic: false,
      isSensor: true,
      collisionFilter: { category: 0x0002, mask: 0x0001 }
    }));
  });

  it('emits Entity.on("collision") callbacks from Matter collisionStart pairs', () => {
    let collisionHandler = null;
    const Matter = {
      Engine: { create: () => ({ world: {} }) },
      Bodies: { rectangle: (x, y, width, height, options) => ({ position: { x, y }, width, height, options }) },
      Composite: { add: vi.fn() },
      Events: { on: vi.fn((engine, event, handler) => { if (event === 'collisionStart') collisionHandler = handler; }) }
    };
    const physics = new PhysicsAddon({ matter: Matter }).mount();
    const player = new Sprite('hero', { width: 10, height: 10 });
    const enemy = new Sprite('enemy', { width: 10, height: 10 });
    const calls = [];
    player.on('collision', (target, payload) => calls.push([target, payload]));

    physics.attachBody(player, { body: { type: 'dynamic', category: 'player', mask: 'enemy' } });
    physics.attachBody(enemy, { body: { type: 'dynamic', category: 'enemy', mask: 'player' } });
    collisionHandler({ pairs: [{ bodyA: player.body, bodyB: enemy.body }] });

    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(enemy);
    expect(calls[0][1].self).toBe(player.body);
  });
});

describe('Pixi z ordering, texture lifecycle, and mobile renderer tuning', () => {
  it('reorders zIndex changes incrementally without resetting the container', () => {
    const stage = {
      children: [],
      addChild: vi.fn((child) => stage.children.push(child)),
      removeChild: vi.fn(),
      removeChildren: vi.fn(),
      setChildIndex: vi.fn((child, index) => {
        stage.children = stage.children.filter((item) => item !== child);
        stage.children.splice(index, 0, child);
      })
    };
    const renderer = new PixiRenderer({ autoZReorder: true });
    renderer.stage = stage;
    renderer.app = { renderer: { render: vi.fn() }, stage };
    const low = { id: 'low', type: 'marker', zIndex: 0, toPixiObject: () => ({ id: 'low' }) };
    const high = { id: 'high', type: 'marker', zIndex: 10, toPixiObject: () => ({ id: 'high' }) };

    renderer.renderScene({ children: [low, high] });
    low.zIndex = 20;
    renderer.renderScene({ children: [low, high] });

    expect(stage.removeChildren).not.toHaveBeenCalled();
    expect(stage.setChildIndex).toHaveBeenCalled();
    expect(stage.children.map((child) => child.id)).toEqual(['high', 'low']);
  });

  it('destroys textures no longer visible after scene switches', () => {
    const destroyed = [];
    const renderer = new PixiRenderer();
    const visibleTexture = { destroy: vi.fn(() => destroyed.push('visible')) };
    const oldTexture = { destroy: vi.fn(() => destroyed.push('old')) };
    renderer.sceneTextures.set('old', oldTexture);
    renderer.sceneTextures.set('visible', visibleTexture);

    renderer.releaseSceneTextures({ children: [{ texture: 'visible' }] });

    expect(oldTexture.destroy).toHaveBeenCalledWith(true);
    expect(visibleTexture.destroy).not.toHaveBeenCalled();
    expect(destroyed).toEqual(['old']);
  });

  it('applies mobile tuning by lowering particle caps and disabling bloom', () => {
    const renderer = new PixiRenderer({ isMobile: true, particleLimit: 1000, enableBloom: true });

    renderer.applyMobileOptimizations();

    expect(renderer.particleLimit).toBeLessThan(1000);
    expect(renderer.enableBloom).toBe(false);
  });
});

describe('EventSheet triggers, function events, and debug tree', () => {
  it('responds to onCollideWith triggers and executes Store-registered functions', () => {
    const store = new Store({ opened: false });
    store.set('openDoor', (runtime) => runtime.store.set('opened', true));
    const bus = new EventBus();
    const sheet = EventSheet.parse({
      debug: true,
      events: [
        {
          when: { onCollideWith: 'player', on: 'door' },
          execute: 'openDoor'
        }
      ]
    });
    const preview = sheet.debugPreview();

    sheet.attach({ store, events: bus, entity: { id: 'door' } });
    bus.emit('collision', { source: { id: 'door' }, target: { id: 'player' } });

    expect(store.get('opened')).toBe(true);
    expect(preview[0].trigger).toMatchObject({ onCollideWith: 'player', on: 'door' });
  });
});

describe('mobile benchmark task wiring', () => {
  it('declares mobile-profile benchmark support for iPhone 12 profiling', () => {
    const script = readFileSync('scripts/benchmark.js', 'utf8');

    expect(script).toContain('mobile-profile');
    expect(script).toContain('iPhone 12');
  });
});
