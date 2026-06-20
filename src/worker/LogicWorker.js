import WorkerManager from './WorkerManager.js';

export const LOGIC_RENDER_STRIDE = 6;

/**
 * Worker-backed game logic frame runner.
 *
 * The shared render channel layout is:
 * x, y, alpha, rotation, scaleX, scaleY per entity.
 */
export class LogicWorker {
  constructor({
    workerManager = new WorkerManager().registerBuiltins(),
    capacity = 1024,
    watchdogMs = 16
  } = {}) {
    this.workerManager = workerManager;
    this.capacity = Math.max(1, Number(capacity) || 1);
    this.watchdogMs = watchdogMs;
    this.channel = this.workerManager.createSharedBuffer({
      name: 'logic-render',
      length: this.capacity * LOGIC_RENDER_STRIDE,
      ArrayType: Float32Array
    });
    this.workerManager.register('logicFrame', runLogicFrame, { pure: true });
  }

  async tick(entities = [], { dt = 1 / 60, aiState = null, collisions = null } = {}) {
    const payload = {
      dt,
      aiState,
      collisions,
      entities: entities.slice(0, this.capacity).map(serializeEntity)
    };
    const result = await this.workerManager.run('logicFrame', payload, { watchdogMs: this.watchdogMs });
    const renderEntities = Array.isArray(result?.entities) ? result.entities : payload.entities;
    const values = packRenderValues(renderEntities, this.capacity);
    const version = this.workerManager.writeSharedFrame(this.channel, values);
    return {
      version,
      entities: renderEntities,
      channel: this.channel
    };
  }

  readRenderFrame() {
    return this.workerManager.readSharedFrame?.(this.channel) || {
      name: this.channel.name,
      values: Array.from(this.channel.view)
    };
  }
}

function runLogicFrame({ entities = [], dt = 1 / 60 } = {}) {
  return {
    entities: entities.map((entity) => ({
      ...entity,
      x: entity.x + entity.vx * dt,
      y: entity.y + entity.vy * dt
    }))
  };
}

function serializeEntity(entity = {}) {
  return {
    id: entity.id ?? null,
    x: finite(entity.x, 0),
    y: finite(entity.y, 0),
    vx: finite(entity.vx, 0),
    vy: finite(entity.vy, 0),
    alpha: finite(entity.alpha, 1),
    rotation: finite(entity.rotation, 0),
    scaleX: finite(entity.scaleX ?? entity.scale?.x, 1),
    scaleY: finite(entity.scaleY ?? entity.scale?.y, 1)
  };
}

function packRenderValues(entities, capacity) {
  const values = new Array(capacity * LOGIC_RENDER_STRIDE).fill(0);
  for (let index = 0; index < Math.min(capacity, entities.length); index += 1) {
    const entity = serializeEntity(entities[index]);
    const offset = index * LOGIC_RENDER_STRIDE;
    values[offset] = entity.x;
    values[offset + 1] = entity.y;
    values[offset + 2] = entity.alpha;
    values[offset + 3] = entity.rotation;
    values[offset + 4] = entity.scaleX;
    values[offset + 5] = entity.scaleY;
  }
  return values;
}

function finite(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export default LogicWorker;
