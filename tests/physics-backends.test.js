import { describe, expect, it } from 'vitest';
import PhysicsWorld from '../src/physics/PhysicsWorld.js';
import { createPhysicsBackend } from '../src/physics/backends/index.js';

function createFakeBackendModule(name) {
  return {
    name,
    created: [],
    createWorld() {
      return { name, bodies: new Map() };
    },
    createBody(world, body) {
      world.bodies.set(body.id, { ...body, backend: name });
      this.created.push(body.id);
      return world.bodies.get(body.id);
    },
    getBody(world, id) {
      return world.bodies.get(id) || null;
    },
    removeBody(world, id) {
      return world.bodies.delete(id);
    },
    step(world, delta) {
      for (const body of world.bodies.values()) {
        body.x += (body.vx || 0) * delta;
        body.y += (body.vy || 0) * delta;
      }
    },
    destroy(world) {
      world.bodies.clear();
    }
  };
}

describe('PhysicsWorld multi-backend switching', () => {
  it('exposes a common backend contract with serialization and restore hooks', async () => {
    const backend = createPhysicsBackend('matter');
    await backend.init();
    const body = backend.createRigidBody({ id: 'crate', x: 1, y: 2, vx: 3, vy: 4 });

    backend.step(0.5);
    const snapshot = backend.serialize();
    backend.destroy();
    await backend.init();
    backend.restore(snapshot);

    expect(body.id).toBe('crate');
    expect(backend.getRigidBody('crate')).toMatchObject({ id: 'crate', x: 2.5, y: 4 });
    expect(backend.raycast({ x: 0, y: 0 }, { x: 1, y: 0 }, 10)).toBeNull();
  });

  it('initializes named backends without requiring a custom module', async () => {
    const world = new PhysicsWorld();

    await world.setBackend('matter');
    world.createRigidBody({ id: 'hero', x: 1, y: 2, vx: 6, vy: 0 });
    world.stepBackend(0.5);
    await world.setBackend('box2d-wasm');

    expect(world.backendName).toBe('box2d-wasm');
    expect(world.getRigidBody('hero')).toMatchObject({ id: 'hero', x: 4, y: 2 });
  });

  it('migrates body state across backend switches', async () => {
    const world = new PhysicsWorld();
    await world.setBackend('matter', { module: createFakeBackendModule('matter') });
    const body = world.createRigidBody({
      id: 'hero',
      x: 2,
      y: 3,
      vx: 4,
      vy: 5,
      width: 10,
      height: 12
    });

    await world.setBackend('rapier', { module: createFakeBackendModule('rapier') });

    expect(world.backendName).toBe('rapier');
    expect(world.getRigidBody('hero')).toMatchObject({
      id: 'hero',
      x: 2,
      y: 3,
      vx: 4,
      vy: 5,
      width: 10,
      height: 12
    });
    expect(body.id).toBe('hero');

    world.stepBackend(0.5);
    expect(world.getRigidBody('hero')).toMatchObject({ x: 4, y: 5.5 });
  });
});
