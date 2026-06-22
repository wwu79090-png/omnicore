export class PhysicsBackend {
  constructor({ name = 'generic', module = null } = {}) {
    this.name = name;
    this.module = module;
    this.world = null;
    this.bodies = new Map();
    this.constraints = new Map();
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
    this.world = this.module?.createWorld?.(options) || { name: this.name, bodies: new Map(), constraints: new Map() };
    if (!this.world.bodies) this.world.bodies = new Map();
    if (!this.world.constraints) this.world.constraints = new Map();
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

  createConstraint(options = {}) {
    if (!this.world) this.createWorld();
    const constraint = normalizeConstraintState(options);
    const nativeConstraint = this.module?.createConstraint
      ? this.module.createConstraint(this.world, constraint)
      : { ...constraint, backend: this.name };
    const stored = { ...constraint, ...nativeConstraint, id: constraint.id, backend: this.name };
    this.constraints.set(stored.id, stored);
    this.world?.constraints?.set?.(stored.id, stored);
    return stored;
  }

  getConstraint(id) {
    return this.world?.constraints?.get?.(id) || this.constraints.get(id) || null;
  }

  removeConstraint(id) {
    this.module?.removeConstraint?.(this.world, id);
    this.world?.constraints?.delete?.(id);
    return this.constraints.delete(id);
  }

  listConstraints() {
    syncConstraintMap(this.constraints, this.world?.constraints);
    return [...this.constraints.values()].map((constraint) => ({ ...constraint }));
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
    return fallbackRaycast([...this.bodies.values()], origin, direction, maxDistance);
  }

  createDebugDraw() {
    return {
      backend: this.name,
      colliders: [...this.bodies.values()].map((body) => ({
        id: body.id,
        shape: body.collider.shape,
        x: body.x,
        y: body.y,
        width: body.collider.width,
        height: body.collider.height,
        radius: body.collider.radius,
        sensor: body.sensor
      })),
      constraints: this.listConstraints().map((constraint) => ({
        id: constraint.id,
        type: constraint.type,
        bodyA: constraint.bodyA,
        bodyB: constraint.bodyB,
        limits: constraint.limits
      }))
    };
  }

  destroy(world = this.world) {
    this.module?.destroy?.(world);
    this.bodies.clear();
    this.constraints.clear();
    world?.bodies?.clear?.();
    world?.constraints?.clear?.();
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
    collider: normalizeColliderState(body.collider || body.shape || body),
    sensor: Boolean(body.sensor || body.isSensor || body.collider?.sensor || body.collider?.isSensor),
    material: body.material || body.physicsMaterial || null,
    collisionFilter: normalizeCollisionFilter(body.collisionFilter),
    backend: body.backend || null
  };
}

export function normalizeConstraintState(constraint = {}) {
  const id = String(constraint.id || constraint.name || `constraint-${Math.random().toString(36).slice(2)}`);
  return {
    id,
    type: constraint.type || 'fixed',
    bodyA: constraint.bodyA || constraint.a || null,
    bodyB: constraint.bodyB || constraint.b || null,
    anchorA: normalizePoint(constraint.anchorA),
    anchorB: normalizePoint(constraint.anchorB),
    limits: constraint.limits ? { ...constraint.limits } : null,
    motor: constraint.motor ? { ...constraint.motor } : null,
    breakForce: constraint.breakForce == null ? null : numberOr(constraint.breakForce, 0),
    collideConnected: Boolean(constraint.collideConnected)
  };
}

function normalizeColliderState(collider = {}) {
  const shape = typeof collider === 'string' ? collider : collider.shape || collider.type || 'box';
  return {
    shape,
    width: numberOr(collider.width, collider.w, collider.size?.[0], 1),
    height: numberOr(collider.height, collider.h, collider.size?.[1], 1),
    radius: numberOr(collider.radius, shape === 'circle' ? 0.5 : 0),
    depth: numberOr(collider.depth, collider.size?.[2], 0),
    sensor: Boolean(collider.sensor || collider.isSensor)
  };
}

function normalizeCollisionFilter(filter = {}) {
  return {
    category: filter.category || 'world',
    mask: Array.isArray(filter.mask) ? [...filter.mask] : (filter.mask == null ? ['world'] : [filter.mask])
  };
}

function fallbackRaycast(bodies, origin = {}, direction = {}, maxDistance = Number.POSITIVE_INFINITY) {
  const start = normalizePoint(origin);
  const dir = normalizeDirection(direction);
  const numericDistance = Number(maxDistance);
  const limit = Number.isFinite(numericDistance) ? Math.max(0, numericDistance) : Number.POSITIVE_INFINITY;
  const hits = bodies
    .map((body) => raycastBody(body, start, dir, limit))
    .filter(Boolean)
    .sort((left, right) => left.distance - right.distance || left.bodyId.localeCompare(right.bodyId));
  return hits[0] || null;
}

function raycastBody(body, origin, direction, maxDistance) {
  const radius = body.collider.shape === 'circle' || body.collider.shape === 'capsule'
    ? Math.max(body.collider.radius, body.collider.width / 2, 0.5)
    : Math.max(body.collider.width, body.collider.height, 1) / 2;
  const toBody = { x: body.x - origin.x, y: body.y - origin.y };
  const projected = toBody.x * direction.x + toBody.y * direction.y;
  if (projected < 0 || projected > maxDistance) return null;
  const closest = {
    x: origin.x + direction.x * projected,
    y: origin.y + direction.y * projected
  };
  const dx = body.x - closest.x;
  const dy = body.y - closest.y;
  if ((dx * dx) + (dy * dy) > radius * radius) return null;
  return {
    bodyId: body.id,
    body,
    distance: projected,
    point: { x: body.x, y: body.y },
    normal: { x: -direction.x, y: -direction.y }
  };
}

function normalizeDirection(direction = {}) {
  const x = numberOr(direction.x, 0);
  const y = numberOr(direction.y, 0);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function normalizePoint(point = {}) {
  return {
    x: numberOr(point.x, 0),
    y: numberOr(point.y, 0)
  };
}

function syncMap(target, source) {
  if (!target?.set || !source?.entries) return;
  target.clear?.();
  for (const [id, body] of source.entries()) target.set(id, normalizeBodyState({ ...body, id }));
}

function syncConstraintMap(target, source) {
  if (!target?.set || !source?.entries) return;
  target.clear?.();
  for (const [id, constraint] of source.entries()) {
    target.set(id, normalizeConstraintState({ ...constraint, id }));
  }
}

function numberOr(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

export default PhysicsBackend;
