import { describe, expect, it } from 'vitest';
import { createOmniCoreWasm } from '@omnicore/core-wasm';

describe('OmniCore core WASM ABI', () => {
  it('runs Store, EventBus, and ECS operations without browser globals', async () => {
    const runtime = await createOmniCoreWasm();

    const store = runtime.createStore();
    store.setI32(7, 42);
    expect(store.has(7)).toBe(true);
    expect(store.getI32(7, 0)).toBe(42);
    expect(store.getI32(8, 11)).toBe(11);

    const bus = runtime.createEventBus();
    expect(bus.emit(3, 99)).toBe(1);
    expect(bus.pending()).toBe(1);
    expect(bus.last()).toEqual({ event: 3, payload: 99 });
    expect(bus.drain()).toBe(1);
    expect(bus.pending()).toBe(0);

    const world = runtime.createWorld({ capacity: 16 });
    const entity = world.createEntity();
    expect(world.isAlive(entity)).toBe(true);
    world.addPosition(entity, 1, 2);
    world.addVelocity(entity, 4, -2);
    world.stepMovement(0.5);
    expect(world.position(entity)).toEqual({ x: 3, y: 1 });
    expect(world.destroyEntity(entity)).toBe(true);
    expect(world.isAlive(entity)).toBe(false);
  });
});
