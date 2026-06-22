export class ThreePhysicsBridge {
  constructor({ physicsWorld = null } = {}) {
    this.physicsWorld = physicsWorld;
    this.bodies = new Map();
    this.constraints = new Map();
  }

  addRigidBody(config = {}) {
    const id = String(config.id || config.name || `body-${this.bodies.size + 1}`);
    const entry = {
      id,
      object: config.object || null,
      body: config.body || null,
      collider: config.collider || null,
      debug: Boolean(config.debug)
    };
    this.bodies.set(id, entry);
    return entry;
  }

  addConstraint(config = {}) {
    const id = String(config.id || config.name || `constraint-${this.constraints.size + 1}`);
    const entry = { ...config, id };
    this.constraints.set(id, entry);
    return entry;
  }

  step(delta = 0) {
    this.physicsWorld?.step?.(delta);
    const syncedBodies = [];
    const debugPrimitives = [];

    for (const entry of this.bodies.values()) {
      this._syncBody(entry);
      syncedBodies.push(entry.id);
      if (entry.debug && entry.collider) debugPrimitives.push(createDebugPrimitive(entry));
    }

    return {
      syncedBodies,
      constraints: [...this.constraints.keys()],
      debugPrimitives
    };
  }

  _syncBody(entry) {
    if (!entry.object || !entry.body) return;
    const position = cloneVector(entry.body.position);
    const quaternion = cloneQuaternion(entry.body.quaternion);
    if (position) writeVector(entry.object, 'position', position);
    if (quaternion) writeVector(entry.object, 'quaternion', quaternion);
  }
}

function createDebugPrimitive(entry) {
  const primitive = {
    id: entry.id,
    type: entry.collider.type || 'collider',
    position: cloneVector(entry.body?.position) || { x: 0, y: 0, z: 0 }
  };
  if (entry.collider.size) primitive.size = [...entry.collider.size];
  if (entry.collider.radius != null) primitive.radius = entry.collider.radius;
  return primitive;
}

function cloneVector(value) {
  if (!value) return null;
  return {
    x: Number(value.x) || 0,
    y: Number(value.y) || 0,
    z: Number(value.z) || 0
  };
}

function cloneQuaternion(value) {
  if (!value) return null;
  return {
    x: Number(value.x) || 0,
    y: Number(value.y) || 0,
    z: Number(value.z) || 0,
    w: value.w == null ? 1 : Number(value.w) || 0
  };
}

function writeVector(object, key, value) {
  if (object[key]?.set) {
    if (key === 'quaternion') object[key].set(value.x, value.y, value.z, value.w);
    else object[key].set(value.x, value.y, value.z);
    return;
  }
  object[key] = value;
}

export default ThreePhysicsBridge;
