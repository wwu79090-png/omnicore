import PhysicsBackend from './PhysicsBackend.js';

export class Box2DWasmBackend extends PhysicsBackend {
  constructor(options = {}) {
    super({ ...options, name: 'box2d-wasm' });
  }
}

export default Box2DWasmBackend;
