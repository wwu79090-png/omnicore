import Box2DWasmBackend from './Box2DWasmBackend.js';
import MatterBackend from './MatterBackend.js';
import PhysicsBackend from './PhysicsBackend.js';
import RapierBackend from './RapierBackend.js';

const BACKENDS = {
  matter: MatterBackend,
  rapier: RapierBackend,
  box2d: Box2DWasmBackend,
  'box2d-wasm': Box2DWasmBackend
};

export function createPhysicsBackend(name, options = {}) {
  const Backend = BACKENDS[name] || PhysicsBackend;
  return new Backend({ ...options, name });
}

export {
  Box2DWasmBackend,
  MatterBackend,
  PhysicsBackend,
  RapierBackend
};
