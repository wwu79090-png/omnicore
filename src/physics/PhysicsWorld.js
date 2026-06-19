import CollisionMask from './CollisionMask.js';
import PhysicsQuery from './PhysicsQuery.js';
import Tilemap from '../tilemap/Tilemap.js';
import { createOmniError } from '../core/OmniError.js';
import { createPhysicsBackend } from './backends/index.js';

/**
 * Lightweight Matter facade for gravity and filtered collision callbacks.
 *
 * @example
 * const world = new PhysicsWorld();
 * world.gravity({ x: 0, y: 1 });
 */
export class PhysicsWorld {
  constructor({ engine = null, metrics = null, matter = null, bounds = null } = {}) {
    this.engine = engine || { world: { gravity: { x: 0, y: 0 } } };
    this.metrics = metrics;
    this.matter = matter;
    this.bounds = bounds ? { ...bounds } : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    this.bodies = new Set();
    this.materials = new Map();
    this.staticCollisionPolygons = [];
    this.staticCollisionIndex = null;
    this.handlers = new Map();
    this.backendName = null;
    this.backendModule = null;
    this.backendWorld = null;
    this.backendAdapter = null;
    this.rigidBodies = new Map();
    this.query = new PhysicsQuery({
      getBodies: () => this._queryBodies(),
      getMatter: () => this.matter
    });
  }

  async setBackend(name, { module = null, backend = null } = {}) {
    if (!name) throw createOmniError('Physics', 'PhysicsWorld.setBackend requires a backend name.');

    this._captureBackendState();
    const snapshot = [...this.rigidBodies.values()].map((body) => ({ ...body }));
    this.backendAdapter?.destroy?.();
    const nextBackend = backend || createPhysicsBackend(name, { module });
    await nextBackend.init({ name });
    nextBackend.restore(snapshot);
    this.backendName = name;
    this.backendAdapter = nextBackend;
    this.backendModule = nextBackend;
    this.backendWorld = nextBackend.world;
    this._captureBackendState();
    return this;
  }

  createRigidBody(body = {}) {
    const id = body.id || `body-${this.rigidBodies.size + 1}`;
    const state = { ...body, id };
    if (!this.backendModule || !this.backendWorld) {
      this.rigidBodies.set(id, state);
      this.addBody(state);
      return state;
    }
    const created = this.backendModule.createBody?.(this.backendWorld, state) || state;
    this.rigidBodies.set(id, { ...created });
    return created;
  }

  getRigidBody(id) {
    if (!id) return null;
    const backendBody = this.backendModule?.getBody?.(this.backendWorld, id);
    if (backendBody) {
      this.rigidBodies.set(id, { ...backendBody });
      return backendBody;
    }
    return this.rigidBodies.get(id) || null;
  }

  removeRigidBody(id) {
    if (!id) return false;
    this.backendModule?.removeBody?.(this.backendWorld, id);
    return this.rigidBodies.delete(id);
  }

  stepBackend(delta = 0) {
    this.backendModule?.step?.(this.backendWorld, Number(delta) || 0);
    this._captureBackendState();
    return this;
  }

  gravity(vector = {}) {
    const applyGravity = () => {
      this.engine.world = this.engine.world || {};
      this.engine.world.gravity = {
        x: vector.x ?? 0,
        y: vector.y ?? 0
      };
    };
    if (this.metrics?.measure) this.metrics.measure('physics.gravity', applyGravity);
    else applyGravity();
    return this;
  }

  onCollision(entity, handler, options = {}) {
    if (!this.handlers.has(entity)) this.handlers.set(entity, []);
    this.handlers.get(entity).push({ handler, mask: options.mask || null });
    return () => {
      const next = (this.handlers.get(entity) || []).filter((item) => item.handler !== handler);
      this.handlers.set(entity, next);
    };
  }

  addBody(body) {
    if (!body) return null;
    this.bodies.add(body);
    this.engine.world = this.engine.world || {};
    this.engine.world.bodies = this.engine.world.bodies || [];
    if (!this.engine.world.bodies.includes(body)) this.engine.world.bodies.push(body);
    return body;
  }

  registerMaterial(name, material = {}) {
    if (!name) return null;
    const normalized = normalizeMaterial(name, material);
    this.materials.set(name, normalized);
    return normalized;
  }

  getMaterial(nameOrMaterial) {
    if (!nameOrMaterial) return null;
    if (typeof nameOrMaterial === 'string') return this.materials.get(nameOrMaterial) || null;
    return normalizeMaterial(nameOrMaterial.name || 'material', nameOrMaterial);
  }

  applyMaterial(body, nameOrMaterial) {
    const material = this.getMaterial(nameOrMaterial);
    if (!body || !material) return body || null;
    applyMaterialToTarget(body, material);
    return body;
  }

  materialAt(tilemap, layerName, point = {}) {
    if (!tilemap?.getTilePhysicsMaterial) return null;
    const tileWidth = Math.max(1, tilemap.tileWidth || 1);
    const tileHeight = Math.max(1, tilemap.tileHeight || 1);
    const cellX = Math.floor(Number(point.x || 0) / tileWidth);
    const cellY = Math.floor(Number(point.y || 0) / tileHeight);
    const tileMaterial = tilemap.getTilePhysicsMaterial(layerName, cellX, cellY);
    if (!tileMaterial) return null;
    const registered = this.materials.get(tileMaterial.name);
    return registered ? { ...tileMaterial, ...registered, name: tileMaterial.name } : tileMaterial;
  }

  removeBody(body) {
    this.bodies.delete(body);
    if (Array.isArray(this.engine.world?.bodies)) {
      this.engine.world.bodies = this.engine.world.bodies.filter((item) => item !== body);
    }
    return body;
  }

  ensurePlayerBounds(player = {}, { padding = 128 } = {}) {
    const x = Number(player.x || 0);
    const y = Number(player.y || 0);
    this.bounds.minX = Math.min(this.bounds.minX, x - padding);
    this.bounds.minY = Math.min(this.bounds.minY, y - padding);
    this.bounds.maxX = Math.max(this.bounds.maxX, x + padding);
    this.bounds.maxY = Math.max(this.bounds.maxY, y + padding);
    this.engine.world.bounds = { ...this.bounds };
    return this.bounds;
  }

  containsPoint(point = {}) {
    const x = Number(point.x || 0);
    const y = Number(point.y || 0);
    return x >= this.bounds.minX && x <= this.bounds.maxX
      && y >= this.bounds.minY && y <= this.bounds.maxY;
  }

  /**
   * Loads pre-baked static tilemap collision polygons without creating bodies.
   *
   * @param {ArrayBuffer|Uint8Array|Buffer} buffer Binary collision payload.
   * @param {object} options Loading options.
   * @returns {object} Load report and performance budget.
   */
  loadStaticCollisionBinary(buffer, { cellSize = 128 } = {}) {
    const arrayBuffer = toArrayBuffer(buffer);
    const decoded = Tilemap.readCollisionBinary(arrayBuffer);
    this.staticCollisionPolygons = decoded.polygons;
    this.staticCollisionIndex = buildPolygonIndex(decoded.polygons, cellSize);
    return {
      colliderSource: 'binary-polygons',
      polygonCount: decoded.polygons.length,
      bodyCount: 0,
      physicsMsBudget: 0.5,
      indexedCells: this.staticCollisionIndex.cells.size
    };
  }

  emitCollision(bodyA, bodyB, entityA = bodyA?.entity, entityB = bodyB?.entity, pair = { bodyA, bodyB }) {
    const emit = () => {
      this._emitOne(entityA, entityB, bodyA, bodyB, pair);
      this._emitOne(entityB, entityA, bodyB, bodyA, pair);
    };
    if (this.metrics?.measure) this.metrics.measure('physics.collision', emit);
    else emit();
  }

  _emitOne(entity, target, self, other, pair) {
    if (!entity || !target) return;
    if (!CollisionMask.allows(self?.collisionFilter || {}, other?.collisionFilter || {})) return;
    for (const { handler, mask } of this.handlers.get(entity) || []) {
      if (mask && !CollisionMask.allows(CollisionMask.filter(self?.collisionFilter?.category || 'world', mask), other?.collisionFilter || {})) continue;
      handler(target, { pair, self, other });
    }
  }

  _queryBodies() {
    if (Array.isArray(this.engine.world?.bodies)) return this.engine.world.bodies;
    return [...this.bodies];
  }

  _captureBackendState() {
    if (!this.backendWorld?.bodies) return;
    if (this.backendWorld.bodies instanceof Map) {
      for (const [id, body] of this.backendWorld.bodies.entries()) {
        this.rigidBodies.set(id, { ...body, id: body.id || id });
      }
      return;
    }
    if (Array.isArray(this.backendWorld.bodies)) {
      for (const body of this.backendWorld.bodies) {
        if (body?.id) this.rigidBodies.set(body.id, { ...body });
      }
    }
  }
}

function toArrayBuffer(buffer) {
  if (buffer && !ArrayBuffer.isView(buffer) && typeof buffer.byteLength === 'number') return buffer;
  if (ArrayBuffer.isView(buffer)) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  return new ArrayBuffer(0);
}

function buildPolygonIndex(polygons = [], cellSize = 128) {
  const size = Math.max(1, Number(cellSize) || 128);
  const cells = new Map();
  for (const polygon of polygons) {
    const minX = Math.floor((polygon.x || 0) / size);
    const maxX = Math.floor(((polygon.x || 0) + (polygon.width || 0)) / size);
    const minY = Math.floor((polygon.y || 0) / size);
    const maxY = Math.floor(((polygon.y || 0) + (polygon.height || 0)) / size);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const key = `${x}:${y}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(polygon);
      }
    }
  }
  return {
    cellSize: size,
    cells,
    query(bounds = {}) {
      const hits = new Set();
      const minX = Math.floor((bounds.x || 0) / size);
      const maxX = Math.floor(((bounds.x || 0) + (bounds.width || 0)) / size);
      const minY = Math.floor((bounds.y || 0) / size);
      const maxY = Math.floor(((bounds.y || 0) + (bounds.height || 0)) / size);
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          for (const polygon of cells.get(`${x}:${y}`) || []) hits.add(polygon);
        }
      }
      return [...hits];
    }
  };
}

function normalizeMaterial(name, material = {}) {
  return {
    name,
    friction: numberOrUndefined(material.friction),
    frictionStatic: numberOrUndefined(material.frictionStatic),
    frictionAir: numberOrUndefined(material.frictionAir),
    restitution: numberOrUndefined(material.restitution),
    speedMultiplier: numberOrUndefined(material.speedMultiplier)
  };
}

function applyMaterialToTarget(target, material) {
  for (const key of ['friction', 'frictionStatic', 'frictionAir', 'restitution', 'speedMultiplier']) {
    if (material[key] !== undefined) target[key] = material[key];
  }
  target.plugin = {
    ...(target.plugin || {}),
    physicsMaterial: material.name
  };
}

function numberOrUndefined(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export default PhysicsWorld;
