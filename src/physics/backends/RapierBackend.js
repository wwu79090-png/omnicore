import PhysicsBackend from './PhysicsBackend.js';

export class RapierBackend extends PhysicsBackend {
  constructor(options = {}) {
    super({ ...options, name: 'rapier' });
  }

  createWorld(options = {}) {
    this.module?.init?.();
    return super.createWorld(options);
  }
}

export default RapierBackend;
