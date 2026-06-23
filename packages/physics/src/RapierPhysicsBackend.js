export class RapierPhysicsBackend {
  constructor({ RAPIER }) {
    if (!RAPIER) throw new Error('RAPIER module is required');
    this.RAPIER = RAPIER;
    this.bodies = new Map();
    this.constraints = new Map();
  }

  createWorld({ gravity = { x: 0, y: 0, z: 0 } } = {}) {
    return new this.RAPIER.World({
      x: Number(gravity.x || 0),
      y: Number(gravity.y || 0),
      z: Number(gravity.z || 0)
    });
  }

  createRigidBody(world, body = {}) {
    const rigidBodyDesc = this.createRigidBodyDesc(body);
    rigidBodyDesc.id = body.id;
    rigidBodyDesc.setTranslation?.(Number(body.x || 0), Number(body.y || 0), Number(body.z || 0));
    const rigidBody = world.createRigidBody(rigidBodyDesc);
    const colliderDesc = this.createColliderDesc(body.collider || body);
    if (colliderDesc?.setSensor) colliderDesc.setSensor(Boolean(body.sensor || body.collider?.sensor));
    const collider = colliderDesc ? world.createCollider(colliderDesc, rigidBody) : null;
    const handle = { body: rigidBody, collider, id: body.id };
    this.bodies.set(body.id, handle);
    return handle;
  }

  createJoint(world, constraint = {}) {
    const bodyA = this.bodies.get(constraint.bodyA)?.body;
    const bodyB = this.bodies.get(constraint.bodyB)?.body;
    if (!bodyA || !bodyB || typeof world.createImpulseJoint !== 'function') return null;
    const joint = this.createJointData(constraint);
    const handle = world.createImpulseJoint(joint, bodyA, bodyB, true);
    this.constraints.set(constraint.id, { constraint, handle });
    return handle;
  }

  step(world) {
    world.step();
    return {
      contacts: [],
      sensors: []
    };
  }

  raycast(world, ray = {}) {
    const RapierRay = this.RAPIER.Ray;
    const origin = {
      x: Number(ray.origin?.x || 0),
      y: Number(ray.origin?.y || 0),
      z: Number(ray.origin?.z || 0)
    };
    const direction = {
      x: Number(ray.direction?.x || 0),
      y: Number(ray.direction?.y || 0),
      z: Number(ray.direction?.z || 0)
    };
    const rapierRay = RapierRay ? new RapierRay(origin, direction) : { origin, direction };
    const hit = world.castRay?.(rapierRay, ray.maxDistance, true);
    if (!hit) return null;
    const body = hit.collider?.parent?.();
    return {
      bodyId: body?.id || body?.desc?.id || null,
      distance: Number(hit.toi ?? hit.timeOfImpact ?? 0),
      point: {
        x: origin.x + direction.x * Number(hit.toi ?? 0),
        y: origin.y + direction.y * Number(hit.toi ?? 0),
        z: origin.z + direction.z * Number(hit.toi ?? 0)
      }
    };
  }

  debugDraw(world) {
    const buffers = world.debugRender?.() || { vertices: [], colors: [] };
    return {
      schema: 'omnicore.rapier-debug-draw.v1',
      source: 'rapier',
      buffers: {
        vertices: Array.from(buffers.vertices || []),
        colors: Array.from(buffers.colors || [])
      },
      colliders: [...this.bodies.values()].map((entry) => ({
        id: entry.id,
        shape: entry.collider?.desc?.shape || entry.collider?.shape || 'unknown'
      })),
      constraints: [...this.constraints.values()].map((entry) => ({
        id: entry.constraint.id,
        type: entry.constraint.type || 'fixed'
      }))
    };
  }

  createRigidBodyDesc(body = {}) {
    if (body.type === 'static' || body.static) return this.RAPIER.RigidBodyDesc.fixed();
    if (body.type === 'kinematic') return this.RAPIER.RigidBodyDesc.kinematicPositionBased();
    return this.RAPIER.RigidBodyDesc.dynamic();
  }

  createColliderDesc(collider = {}) {
    const shape = collider.shape || collider.type || 'box';
    if (shape === 'ball' || shape === 'sphere' || shape === 'circle') {
      return this.RAPIER.ColliderDesc.ball(Number(collider.radius || 0.5));
    }
    if (shape === 'capsule') {
      return this.RAPIER.ColliderDesc.capsule(Number(collider.height || 1) / 2, Number(collider.radius || 0.5));
    }
    return this.RAPIER.ColliderDesc.cuboid(
      Number(collider.width || 1) / 2,
      Number(collider.height || 1) / 2,
      Number(collider.depth || 1) / 2
    );
  }

  createJointData(constraint = {}) {
    if (constraint.type === 'fixed' && this.RAPIER.JointData?.fixed) return this.RAPIER.JointData.fixed();
    if (constraint.type === 'revolute' && this.RAPIER.JointData?.revolute) {
      return this.RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    }
    return this.RAPIER.JointData?.fixed?.() || { type: constraint.type || 'fixed' };
  }
}

export function createRapierPhysicsBackend({
  id = 'rapier',
  RAPIER,
  purpose = 'Rapier JS backend for rigid bodies, colliders, sensors, joints, raycasts, and debug draw.'
} = {}) {
  const module = new RapierPhysicsBackend({ RAPIER });
  return {
    id,
    kind: 'rapier',
    purpose,
    capabilities: ['rigid-bodies', 'colliders', 'sensors', 'constraints', 'raycast', 'debug-draw'],
    available: Boolean(RAPIER),
    fallback: 'arcade',
    module,
    external: true
  };
}

export default RapierPhysicsBackend;
