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
    this.constraints = new Map();
    this.query = new PhysicsQuery({
      getBodies: () => this._queryBodies(),
      getMatter: () => this.matter
    });
  }

  async setBackend(name, { module = null, backend = null } = {}) {
    if (!name) throw createOmniError('Physics', 'PhysicsWorld.setBackend requires a backend name.');

    this._captureBackendState();
    const snapshot = [...this.rigidBodies.values()].map((body) => ({ ...body }));
    const constraints = [...this.constraints.values()].map((constraint) => ({ ...constraint }));
    this.backendAdapter?.destroy?.();
    const nextBackend = backend || createPhysicsBackend(name, { module });
    await nextBackend.init({ name });
    nextBackend.restore(snapshot);
    constraints.forEach((constraint) => nextBackend.createConstraint?.(constraint));
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

  createConstraint(constraint = {}) {
    const created = this.backendModule?.createConstraint?.(constraint) || normalizeConstraint(constraint, this.constraints.size);
    this.constraints.set(created.id, { ...created });
    return created;
  }

  getConstraint(id) {
    if (!id) return null;
    const backendConstraint = this.backendModule?.getConstraint?.(id);
    if (backendConstraint) {
      this.constraints.set(id, { ...backendConstraint });
      return backendConstraint;
    }
    return this.constraints.get(id) || null;
  }

  removeConstraint(id) {
    if (!id) return false;
    this.backendModule?.removeConstraint?.(id);
    return this.constraints.delete(id);
  }

  raycast(origin = {}, direction = {}, maxDistance = Number.POSITIVE_INFINITY) {
    const hit = this.backendModule?.raycast?.(origin, direction, maxDistance);
    if (hit) return hit;
    return fallbackWorldRaycast([...this.rigidBodies.values()], origin, direction, maxDistance);
  }

  createDebugDraw() {
    const backendDebug = this.backendModule?.createDebugDraw?.();
    if (backendDebug) return backendDebug;
    return {
      backend: this.backendName || 'local',
      colliders: [...this.rigidBodies.values()].map((body) => {
        const collider = normalizeCollider(body.collider || body);
        return {
          id: body.id,
          shape: collider.shape,
          x: Number(body.x || 0),
          y: Number(body.y || 0),
          width: collider.width,
          height: collider.height,
          radius: collider.radius,
          sensor: Boolean(body.sensor || collider.sensor)
        };
      }),
      constraints: [...this.constraints.values()].map((constraint) => ({ ...constraint }))
    };
  }

  createBackendCapabilityReport() {
    return {
      format: 'OmniCore.PhysicsBackendCapabilityReport',
      activeBackend: this.backendName || 'local',
      backends: [
        { id: 'matter', kind: 'javascript', role: '2d-rigid-body' },
        { id: 'rapier', kind: 'wasm-adapter', role: '2d-3d-rigid-body' },
        { id: 'box2d-wasm', kind: 'wasm-adapter', role: '2d-platformer' }
      ],
      capabilities: [
        'rigid-bodies',
        'colliders',
        'sensors',
        'constraints',
        'raycast',
        'debug-draw'
      ],
      bodyCount: this.rigidBodies.size,
      constraintCount: this.constraints.size
    };
  }

  createDiagnosticsSnapshot({
    raycasts = [],
    includeDebugDraw = true,
    includeBackendCapabilities = true
  } = {}) {
    this._captureBackendState();

    const bodies = [...this.rigidBodies.values()].map((body) => normalizeDiagnosticBody(body));
    const constraints = [...this.constraints.values()].map((constraint, index) => normalizeDiagnosticConstraint(constraint, index));
    const bodyIds = new Set(bodies.map((body) => body.id));
    const raycastReports = normalizeArray(raycasts).map((probe, index) => {
      const normalized = normalizeRaycastProbe(probe, index);
      const hit = this.raycast(normalized.origin, normalized.direction, normalized.maxDistance);
      return {
        ...normalized,
        hit: hit ? normalizeRaycastHit(hit) : null
      };
    });
    const debugDraw = includeDebugDraw ? this.createDebugDraw() : null;
    const backendCapabilities = includeBackendCapabilities ? this.createBackendCapabilityReport() : null;
    const issues = createPhysicsDiagnosticsIssues({ constraints, bodyIds });
    const severity = createPhysicsDiagnosticsSeverity(issues);

    return {
      schema: 'omnicore.physics-diagnostics-snapshot.v1',
      backend: this.backendName || 'local',
      summary: createPhysicsDiagnosticsSummary({
        bodies,
        constraints,
        raycasts: raycastReports,
        debugDraw,
        severity
      }),
      issues,
      bodies,
      constraints,
      raycasts: raycastReports,
      debugDraw,
      backendCapabilities,
      crossEngineProfile: createPhysicsDiagnosticsProfile()
    };
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
    }
    if (Array.isArray(this.backendWorld.bodies)) {
      for (const body of this.backendWorld.bodies) {
        if (body?.id) this.rigidBodies.set(body.id, { ...body });
      }
    }
    if (this.backendWorld.constraints instanceof Map) {
      for (const [id, constraint] of this.backendWorld.constraints.entries()) {
        this.constraints.set(id, { ...constraint, id: constraint.id || id });
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

function normalizeConstraint(constraint = {}, index = 0) {
  return {
    id: String(constraint.id || constraint.name || `constraint-${index + 1}`),
    type: constraint.type || 'fixed',
    bodyA: constraint.bodyA || constraint.a || null,
    bodyB: constraint.bodyB || constraint.b || null,
    anchorA: constraint.anchorA ? { ...constraint.anchorA } : { x: 0, y: 0 },
    anchorB: constraint.anchorB ? { ...constraint.anchorB } : { x: 0, y: 0 },
    limits: constraint.limits ? { ...constraint.limits } : null,
    motor: constraint.motor ? { ...constraint.motor } : null
  };
}

function normalizeDiagnosticConstraint(constraint = {}, index = 0) {
  const normalized = normalizeConstraint(constraint, index);
  return {
    ...normalized,
    backend: constraint.backend || null,
    breakForce: constraint.breakForce == null ? null : numberOr(constraint.breakForce, 0),
    collideConnected: Boolean(constraint.collideConnected)
  };
}

function normalizeCollider(collider = {}) {
  const shape = typeof collider === 'string' ? collider : collider.shape || collider.type || 'box';
  return {
    shape,
    width: numberOr(collider.width, collider.w, collider.size?.[0], 1),
    height: numberOr(collider.height, collider.h, collider.size?.[1], 1),
    radius: numberOr(collider.radius, shape === 'circle' ? 0.5 : 0),
    sensor: Boolean(collider.sensor || collider.isSensor)
  };
}

function normalizeDiagnosticBody(body = {}) {
  const collider = normalizeCollider(body.collider || body.shape || body);
  const sensor = Boolean(body.sensor || body.isSensor || collider.sensor);
  const type = body.type || (body.isStatic || body.static ? 'static' : 'dynamic');
  return {
    id: String(body.id || body.name || ''),
    name: body.name || body.id || null,
    type,
    collider: {
      ...collider,
      sensor
    },
    sensor,
    material: body.material || body.physicsMaterial || body.plugin?.physicsMaterial || null,
    position: normalizePoint(body.position || body),
    velocity: {
      x: numberOr(body.vx, body.velocity?.x, 0),
      y: numberOr(body.vy, body.velocity?.y, 0)
    },
    angle: numberOr(body.angle, body.rotation, 0),
    angularVelocity: numberOr(body.angularVelocity, 0),
    backend: body.backend || null,
    collisionFilter: normalizeDiagnosticCollisionFilter(body.collisionFilter)
  };
}

function normalizeDiagnosticCollisionFilter(filter = {}) {
  return {
    category: filter.category || 'world',
    mask: Array.isArray(filter.mask) ? [...filter.mask] : (filter.mask == null ? ['world'] : [filter.mask])
  };
}

function normalizeRaycastProbe(probe = {}, index = 0) {
  return {
    id: String(probe.id || probe.name || `raycast-${index + 1}`),
    origin: normalizePoint(probe.origin || probe.from || probe),
    direction: normalizeDirection(probe.direction || probe.dir || { x: 1, y: 0 }),
    maxDistance: normalizeDistance(probe.maxDistance ?? probe.distance ?? probe.length)
  };
}

function normalizeRaycastHit(hit = {}) {
  return {
    bodyId: hit.bodyId || hit.body?.id || null,
    distance: numberOr(hit.distance, 0),
    point: normalizePoint(hit.point),
    normal: normalizeDirection(hit.normal || { x: 0, y: -1 }),
    body: hit.body ? normalizeDiagnosticBody(hit.body) : null
  };
}

function normalizeDistance(distance) {
  const numeric = Number(distance);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : Number.POSITIVE_INFINITY;
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function createPhysicsDiagnosticsIssues({ constraints = [], bodyIds = new Set() } = {}) {
  const issues = [];
  for (const constraint of constraints) {
    if (constraint.bodyA && !bodyIds.has(constraint.bodyA)) {
      issues.push({
        id: `missing-body:${constraint.id}:bodyA`,
        severity: 'warning',
        type: 'missing-constraint-body',
        message: `Constraint ${constraint.id} references missing bodyA ${constraint.bodyA}.`,
        constraintId: constraint.id,
        bodyId: constraint.bodyA
      });
    }
    if (constraint.bodyB && !bodyIds.has(constraint.bodyB)) {
      issues.push({
        id: `missing-body:${constraint.id}:bodyB`,
        severity: 'warning',
        type: 'missing-constraint-body',
        message: `Constraint ${constraint.id} references missing bodyB ${constraint.bodyB}.`,
        constraintId: constraint.id,
        bodyId: constraint.bodyB
      });
    }
  }
  return issues;
}

function createPhysicsDiagnosticsSeverity(issues = []) {
  if (issues.some((issue) => issue.severity === 'error')) return 'error';
  if (issues.length > 0) return 'warning';
  return 'ok';
}

function createPhysicsDiagnosticsSummary({
  bodies = [],
  constraints = [],
  raycasts = [],
  debugDraw = null,
  severity = 'ok'
} = {}) {
  return {
    bodyCount: bodies.length,
    sensorCount: bodies.filter((body) => body.sensor).length,
    staticBodyCount: bodies.filter((body) => body.type === 'static').length,
    dynamicBodyCount: bodies.filter((body) => body.type !== 'static').length,
    constraintCount: constraints.length,
    raycastCount: raycasts.length,
    raycastHitCount: raycasts.filter((raycast) => raycast.hit).length,
    debugColliderCount: Array.isArray(debugDraw?.colliders) ? debugDraw.colliders.length : 0,
    severity
  };
}

function createPhysicsDiagnosticsProfile() {
  return {
    sources: [
      'Godot Visible Collision Shapes',
      'Unity Physics Debugger',
      'Unreal Physics Debug Draw',
      'Rapier debug render pipeline',
      'Matter.js Render debug overlay'
    ],
    capabilities: [
      'physics-world-snapshot',
      'sensor-and-constraint-audit',
      'raycast-probe-report',
      'editor-debug-draw-payload',
      'backend-capability-summary'
    ]
  };
}

function fallbackWorldRaycast(bodies, origin = {}, direction = {}, maxDistance = Number.POSITIVE_INFINITY) {
  const start = normalizePoint(origin);
  const dir = normalizeDirection(direction);
  const limit = Number.isFinite(Number(maxDistance)) ? Number(maxDistance) : Number.POSITIVE_INFINITY;
  return bodies
    .map((body) => raycastWorldBody(body, start, dir, limit))
    .filter(Boolean)
    .sort((left, right) => left.distance - right.distance || left.bodyId.localeCompare(right.bodyId))[0] || null;
}

function raycastWorldBody(body, origin, direction, maxDistance) {
  const collider = normalizeCollider(body.collider || body);
  const radius = collider.shape === 'circle' || collider.shape === 'capsule'
    ? Math.max(collider.radius, 0.5)
    : Math.max(collider.width, collider.height, 1) / 2;
  const x = Number(body.x || body.position?.x || 0);
  const y = Number(body.y || body.position?.y || 0);
  const projected = ((x - origin.x) * direction.x) + ((y - origin.y) * direction.y);
  if (projected < 0 || projected > maxDistance) return null;
  const closest = {
    x: origin.x + direction.x * projected,
    y: origin.y + direction.y * projected
  };
  const dx = x - closest.x;
  const dy = y - closest.y;
  if ((dx * dx) + (dy * dy) > radius * radius) return null;
  return {
    bodyId: body.id,
    body,
    distance: projected,
    point: { x, y },
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

function numberOr(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

export default PhysicsWorld;
