const DRIFT_WARNING = '[OmniCore] 物理与渲染坐标漂移，已自动修正';

function entityPosition(entity = {}) {
  return {
    x: Number(entity.x || 0),
    y: Number(entity.y || 0)
  };
}

function bodyPosition(body = {}) {
  body.position = body.position || { x: 0, y: 0 };
  return body.position;
}

/**
 * Keeps Matter body coordinates aligned with render entity coordinates.
 */
export class PhysicsCollisionSync {
  constructor({
    threshold = 0.5,
    warn = (message) => console.warn(message)
  } = {}) {
    this.threshold = threshold;
    this.warn = warn;
    this.lastFrameByBody = new WeakMap();
  }

  sync(entity, body = entity?.body, { frame = null } = {}) {
    if (!entity || !body) return { corrected: false, skipped: true, reason: 'missing-target' };
    if (frame != null && this.lastFrameByBody.get(body) === frame) {
      return { corrected: false, skipped: true, reason: 'already-checked' };
    }
    if (frame != null) this.lastFrameByBody.set(body, frame);

    const render = entityPosition(entity);
    const physics = bodyPosition(body);
    const dx = Math.abs(physics.x - render.x);
    const dy = Math.abs(physics.y - render.y);
    if (dx <= this.threshold && dy <= this.threshold) {
      return { corrected: false, skipped: false, dx, dy };
    }

    physics.x = render.x;
    physics.y = render.y;
    this.warn?.(DRIFT_WARNING);
    return {
      corrected: true,
      skipped: false,
      dx,
      dy,
      x: render.x,
      y: render.y
    };
  }

  syncAll(entities = [], { frame = null } = {}) {
    let corrected = 0;
    for (const entity of entities) {
      if (this.sync(entity, entity?.body, { frame }).corrected) corrected += 1;
    }
    return corrected;
  }
}

export const DEFAULT_PHYSICS_COLLISION_SYNC = new PhysicsCollisionSync();

export function syncPhysicsBodyToEntity(entity, body = entity?.body, options = {}, sync = DEFAULT_PHYSICS_COLLISION_SYNC) {
  return sync.sync(entity, body, options);
}

export default DEFAULT_PHYSICS_COLLISION_SYNC;
