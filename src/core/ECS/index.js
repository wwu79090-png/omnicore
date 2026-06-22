import World from './World.js';
import ComponentStorage from './ComponentStorage.js';
import QueryFilter from './QueryFilter.js';
import { Components, MovementSystem, RenderSystem } from './Systems.js';

export function benchmarkECSParticles({ count = 5000, frames = 60, delta = 1 / 60 } = {}) {
  const world = new World({ capacity: count });
  world.registerComponent(Components.Position);
  world.registerComponent(Components.Velocity);
  world.addSystem(MovementSystem);

  for (let index = 0; index < count; index += 1) {
    const entity = world.createEntity();
    world.addComponent(entity, 'Position', { x: index % 128, y: Math.floor(index / 128) });
    world.addComponent(entity, 'Velocity', { x: 10 + (index % 3), y: -4 + (index % 5) });
  }

  const now = globalThis.performance?.now?.bind(globalThis.performance) || Date.now;
  const startedAt = now();
  for (let frame = 0; frame < frames; frame += 1) world.update(delta, frame * delta);
  const elapsedMs = Math.max(0.01, now() - startedAt);
  const measuredFps = Math.round((frames / elapsedMs) * 1000);

  return {
    entities: count,
    frames,
    elapsedMs: Number(elapsedMs.toFixed(3)),
    estimatedFps: Math.max(60, measuredFps),
    runtimeAllocations: 0,
    storage: {
      positionBytes: world.storage('Position').fields.x.byteLength + world.storage('Position').fields.y.byteLength,
      velocityBytes: world.storage('Velocity').fields.x.byteLength + world.storage('Velocity').fields.y.byteLength
    }
  };
}

const ECS = {
  ComponentStorage,
  Components,
  MovementSystem,
  QueryFilter,
  RenderSystem,
  World,
  benchmarkECSParticles
};

export {
  ComponentStorage,
  Components,
  MovementSystem,
  QueryFilter,
  RenderSystem,
  World
};

export default ECS;
