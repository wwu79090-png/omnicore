export class PhysicsBackend {
  constructor({ name = 'generic', module = null } = {}) {
    this.name = name;
    this.module = module;
    this.world = null;
    this.bodies = new Map();
  }

  async init(options = {}) {
    this.createWorld(options);
    return this;
  }

  serialize() {
    if (this.world?.bodies) syncMap(this.bodies, this.world.bodies);
    return [...this.bodies.values()].map((body) => normalizeBodyState(body));
  }

  restore(snapshot = []) {
    this.bodies.clear();
    this.world?.bodies?.clear?.();
    for (const body of snapshot) this.createRigidBody(body);
    return this;
  }

  createWorld(options = {}) {
    this.world = this.module?.createWorld?.(options) || { name: this.name, bodies: new Map() };
    if (!this.world.bodies) this.world.bodies = new Map();
    return this.world;
  }

  createRigidBody(options = {}) {
    if (!this.world) this.createWorld();
    return this.createBody(this.world, options);
  }

  createBody(world, options = {}) {
    const body = normalizeBodyState(options);
    const nativeBody = this.module?.createBody
      ? this.module.createBody(world, body)
      : { ...body, backend: this.name };
    const stored = normalizeBodyState({ ...body, ...nativeBody, id: body.id, backend: this.name });
    this.bodies.set(stored.id, stored);
    world?.bodies?.set?.(stored.id, stored);
    return stored;
  }

  getRigidBody(id) {
    return this.getBody(this.world, id);
  }

  getBody(world, id) {
    const nativeBody = this.module?.getBody?.(world, id) || world?.bodies?.get?.(id);
    if (!nativeBody) return this.bodies.get(id) || null;
    const stored = normalizeBodyState({ ...this.bodies.get(id), ...nativeBody, id });
    this.bodies.set(id, stored);
    return stored;
  }

  removeRigidBody(id) {
    return this.removeBody(this.world, id);
  }

  removeBody(world, id) {
    this.module?.removeBody?.(world, id);
    world?.bodies?.delete?.(id);
    return this.bodies.delete(id);
  }

  step(world, delta = 1 / 60) {
    if (typeof world === 'number') {
      this.step(this.world, world);
      return;
    }
    const activeWorld = world || this.world;
    if (this.module?.step) {
      this.module.step(activeWorld, delta);
      syncMap(this.bodies, activeWorld?.bodies);
      return;
    }
    for (const body of this.bodies.values()) {
      body.x += (body.vx || 0) * delta;
      body.y += (body.vy || 0) * delta;
    }
    syncMap(activeWorld?.bodies, this.bodies);
  }

  raycast(origin = {}, direction = {}, maxDistance = Number.POSITIVE_INFINITY) {
    if (this.module?.raycast) {
      return this.module.raycast(this.world, origin, direction, maxDistance);
    }
    return null;
  }

  destroy(world = this.world) {
    this.module?.destroy?.(world);
    this.bodies.clear();
    world?.bodies?.clear?.();
    if (world === this.world) this.world = null;
  }
}

export function normalizeBodyState(body = {}) {
  const id = String(body.id ?? body.entityId ?? `body-${Math.random().toString(36).slice(2)}`);
  return {
    id,
    x: numberOr(body.x, body.position?.x, 0),
    y: numberOr(body.y, body.position?.y, 0),
    vx: numberOr(body.vx, body.velocity?.x, 0),
    vy: numberOr(body.vy, body.velocity?.y, 0),
    angle: numberOr(body.angle, body.rotation, 0),
    angularVelocity: numberOr(body.angularVelocity, 0),
    width: numberOr(body.width, body.w, 1),
    height: numberOr(body.height, body.h, 1),
    radius: numberOr(body.radius, 0),
    type: body.type || 'dynamic',
    sensor: Boolean(body.sensor || body.isSensor),
    material: body.material || body.physicsMaterial || null,
    backend: body.backend || null
  };
}

function syncMap(target, source) {
  if (!target?.set || !source?.entries) return;
  target.clear?.();
  for (const [id, body] of source.entries()) target.set(id, normalizeBodyState({ ...body, id }));
}

function numberOr(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

export default PhysicsBackend;
