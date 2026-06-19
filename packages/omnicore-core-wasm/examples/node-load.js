#!/usr/bin/env node
import { createOmniCoreWasm } from '../adapters/node.js';

const runtime = await createOmniCoreWasm();
const store = runtime.createStore();
store.setI32(1, 9001);

const world = runtime.createWorld({ capacity: 32 });
const entity = world.createEntity();
world.addPosition(entity, 4, 8);
world.addVelocity(entity, 2, -1);
world.stepMovement(0.5);

console.log(JSON.stringify({
  version: runtime.version(),
  score: store.getI32(1, 0),
  entity,
  position: world.position(entity)
}, null, 2));
