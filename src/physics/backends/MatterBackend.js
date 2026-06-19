import PhysicsBackend, { normalizeBodyState } from './PhysicsBackend.js';

export class MatterBackend extends PhysicsBackend {
  constructor(options = {}) {
    super({ ...options, name: 'matter' });
  }

  createWorld(options = {}) {
    if (this.module?.Engine?.create) {
      const engine = this.module.Engine.create();
      this.world = engine.world || { bodies: new Map() };
      if (!this.world.bodies) this.world.bodies = new Map();
      return this.world;
    }
    return super.createWorld(options);
  }

  createBody(world, options = {}) {
    if (this.module?.Bodies?.rectangle) {
      const state = normalizeBodyState(options);
      const body = this.module.Bodies.rectangle(
        state.x,
        state.y,
        state.width,
        state.height,
        { isStatic: state.type === 'static', isSensor: state.sensor }
      );
      return super.createBody(world, { ...state, ...body, id: state.id });
    }
    return super.createBody(world, options);
  }
}

export default MatterBackend;
