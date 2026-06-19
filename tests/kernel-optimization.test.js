import { describe, expect, it, vi } from 'vitest';
import OmniCore from '../src/index.js';
import {
  Components,
  MovementSystem,
  RenderSystem,
  World,
  benchmarkECSParticles
} from '../src/core/ECS/index.js';
import { PoolRegistry } from '../src/core/MemoryPool.js';
import { CommandBuffer, PixiBatchAdapter } from '../src/renderer/PixiBatchAdapter.js';
import { DebugRenderer, createDebugAPI, isDebugBuildEnabled } from '../src/debug/DebugRenderer.js';

describe('ECS kernel storage and systems', () => {
  it('keeps component definitions as pure data descriptors', () => {
    expect(Components.Position).toEqual({
      name: 'Position',
      fields: { x: 'f32', y: 'f32' }
    });
    expect(Object.values(Components.Position)).not.toContain(expect.any(Function));
    expect(Object.values(Components.Health)).not.toContain(expect.any(Function));
    expect(Object.values(Components.SpriteRef)).not.toContain(expect.any(Function));
  });

  it('stores same-type components in contiguous typed arrays and updates through logic-only systems', () => {
    const world = new World({ capacity: 8 });
    world.registerComponent(Components.Position);
    world.registerComponent(Components.Velocity);
    world.addSystem(MovementSystem);

    const first = world.createEntity();
    const second = world.createEntity();
    world.addComponent(first, 'Position', { x: 1, y: 2 });
    world.addComponent(first, 'Velocity', { x: 4, y: 8 });
    world.addComponent(second, 'Position', { x: 10, y: 20 });
    world.addComponent(second, 'Velocity', { x: -2, y: 1 });

    world.update(0.5);

    const positions = world.storage('Position');
    expect(positions.fields.x).toBeInstanceOf(Float32Array);
    expect(positions.fields.y).toBeInstanceOf(Float32Array);
    expect([...positions.entityIds.slice(0, positions.length)]).toEqual([first, second]);
    expect(world.getComponent(first, 'Position')).toEqual({ x: 3, y: 6 });
    expect(world.getComponent(second, 'Position')).toEqual({ x: 9, y: 20.5 });
    expect(typeof MovementSystem).toBe('function');
  });

  it('runs a 5000-particle ECS movement benchmark with no per-frame allocations reported', () => {
    const result = benchmarkECSParticles({ count: 5000, frames: 60, delta: 1 / 60 });

    expect(result.entities).toBe(5000);
    expect(result.frames).toBe(60);
    expect(result.estimatedFps).toBeGreaterThanOrEqual(60);
    expect(result.runtimeAllocations).toBe(0);
  });
});

describe('fixed MemoryPool and OmniCore.Pool registry', () => {
  it('preallocates slots and never expands during runtime allocation', () => {
    const registry = new PoolRegistry();
    let created = 0;
    const pool = registry.create('sprites', 2, {
      factory: (slot) => {
        created += 1;
        return { slot, texture: null, transform: null, visible: false };
      },
      reset: (sprite) => {
        sprite.texture = null;
        sprite.visible = false;
      }
    });

    expect(created).toBe(2);
    const first = pool.allocate();
    const second = pool.allocate();
    expect(() => pool.allocate()).toThrow(/exhausted|capacity/i);

    first.texture = 'atlas://hero';
    first.transform.x = 42;
    first.transform.y = 24;
    first.visible = true;
    pool.free(first);

    const reused = pool.allocate();
    expect(reused).toBe(first);
    expect(reused.texture).toBe(null);
    expect(reused.visible).toBe(false);
    expect(reused.transform.x).toBe(0);
    expect(reused.transform.y).toBe(0);
    expect(pool.stats()).toMatchObject({ capacity: 2, available: 0, active: 2, created: 2 });

    pool.free(second);
    pool.free(reused);
  });

  it('exposes OmniCore.Pool.create and keeps transform data in a contiguous arena', () => {
    const pool = OmniCore.Pool.create('test-entities', 3);
    const entity = pool.allocate();
    entity.transform.x = 7;
    entity.transform.scaleX = 2;

    expect(pool.transforms).toBeInstanceOf(Float32Array);
    expect(pool.transforms.length).toBe(3 * 8);
    expect(entity.transform.x).toBe(7);
    expect(entity.transform.scaleX).toBe(2);

    pool.free(entity);
    expect(entity.transform.x).toBe(0);
    expect(entity.transform.scaleX).toBe(1);
    OmniCore.Pool.destroy('test-entities');
  });
});

describe('Pixi command-buffer batch adapter', () => {
  it('sorts draw commands by texture key first and zIndex second to preserve batching', () => {
    const buffer = new CommandBuffer({ capacity: 6 });
    buffer.push({ texture: 'atlas-b', x: 0, y: 0, zIndex: 1, color: 0xffffff });
    buffer.push({ texture: 'atlas-a', x: 0, y: 0, zIndex: 10, color: 0xffffff });
    buffer.push({ texture: 'atlas-a', x: 0, y: 0, zIndex: 2, color: 0xffffff });
    buffer.push({ texture: 'atlas-b', x: 0, y: 0, zIndex: 0, color: 0xffffff });

    const sorted = buffer.sort();

    expect(sorted.map((command) => `${command.texture}:${command.zIndex}`)).toEqual([
      'atlas-a:2',
      'atlas-a:10',
      'atlas-b:0',
      'atlas-b:1'
    ]);
  });

  it('flushes sorted commands to Pixi in one submit call and reuses command storage', () => {
    const adapter = new PixiBatchAdapter({ capacity: 4 });
    const submit = vi.fn();

    adapter.drawSprite({ texture: 'b', x: 5, y: 6, zIndex: 1, color: 0xff0000 });
    adapter.drawSprite({ texture: 'a', x: 1, y: 2, zIndex: 9, color: 0xffffff });
    const firstCommandRef = adapter.buffer.commands[0];
    const flushed = adapter.flush(submit);

    expect(flushed).toBe(2);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][0].map((command) => command.texture)).toEqual(['a', 'b']);
    expect(adapter.buffer.length).toBe(0);

    adapter.drawSprite({ texture: 'c', x: 0, y: 0, zIndex: 0 });
    expect(adapter.buffer.commands[0]).toBe(firstCommandRef);
  });

  it('renders ECS SpriteRef data into the command buffer without touching Pixi Sprite allocation', () => {
    const world = new World({ capacity: 4 });
    world.registerComponent(Components.Position);
    world.registerComponent(Components.SpriteRef);
    const adapter = new PixiBatchAdapter({ capacity: 4 });
    world.addSystem(RenderSystem(adapter));

    const entity = world.createEntity();
    world.addComponent(entity, 'Position', { x: 12, y: 34 });
    world.addComponent(entity, 'SpriteRef', { texture: 'atlas://hero', zIndex: 5, color: 0x00ff00 });
    world.update(0);

    expect(adapter.buffer.length).toBe(1);
    expect(adapter.buffer.commands[0]).toMatchObject({
      texture: 'atlas://hero',
      x: 12,
      y: 34,
      zIndex: 5,
      color: 0x00ff00
    });
  });
});

describe('debug render primitives', () => {
  it('records primitives only when debug is enabled and flushes as an overlay path', () => {
    const disabled = new DebugRenderer({ debug: false });
    expect(disabled.drawCircle(10, 20, 5, 0xff00ff)).toBe(null);
    expect(disabled.commands.length).toBe(0);

    const renderer = new DebugRenderer({ debug: true });
    renderer.drawLine(0, 1, 2, 3, 0xffffff);
    renderer.drawCircle(10, 20, 5, 0xff00ff);
    renderer.drawAABB({ x: 1, y: 2, width: 3, height: 4 }, 0x00ff00);

    const overlay = { clear: vi.fn(), draw: vi.fn() };
    expect(renderer.flush(overlay)).toBe(3);
    expect(overlay.draw.mock.calls.map(([command]) => command.type)).toEqual(['line', 'circle', 'aabb']);
    expect(renderer.commands.length).toBe(0);
  });

  it('provides a no-op public Debug API when debug is false', () => {
    const api = createDebugAPI({ debug: false });

    expect(api.drawLine(0, 0, 1, 1)).toBe(null);
    expect(api.renderer).toBe(null);
    expect(isDebugBuildEnabled({ debug: false, mode: 'production' })).toBe(false);
    expect(isDebugBuildEnabled({ debug: true, mode: 'development' })).toBe(true);
  });
});
