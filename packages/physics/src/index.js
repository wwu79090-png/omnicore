const DEFAULT_CAPABILITIES = [
  'rigid-bodies',
  'colliders',
  'sensors',
  'constraints',
  'raycast',
  'debug-draw'
];

export function createPhysicsRegistry({ backends = [] } = {}) {
  const registry = new Map();
  let activeBackend = null;
  const api = {
    registerBackend(backend) {
      if (!backend?.id) throw new Error('physics backend id is required');
      registry.set(backend.id, normalizeBackendDescriptor(backend));
      if (!activeBackend) activeBackend = backend.id;
      return registry.get(backend.id);
    },
    useBackend(id) {
      if (!registry.has(id)) throw new Error(`unknown physics backend: ${id}`);
      activeBackend = id;
      return registry.get(id);
    },
    getActiveBackend() {
      return registry.get(activeBackend) || null;
    },
    listBackends() {
      return [...registry.values()].map((backend) => ({
        id: backend.id,
        kind: backend.kind,
        purpose: backend.purpose,
        capabilities: [...backend.capabilities],
        available: backend.available,
        fallback: backend.fallback || null
      }));
    }
  };
  for (const backend of backends) api.registerBackend(backend);
  return api;
}

export function createArcadeBackend() {
  return {
    id: 'arcade',
    kind: 'javascript',
    purpose: 'Stateful deterministic 2D arcade physics for gameplay and editor previews.',
    capabilities: DEFAULT_CAPABILITIES,
    available: true
  };
}

export function createArcadeLiteBackend() {
  return {
    id: 'arcade-lite',
    kind: 'javascript',
    purpose: 'Default lightweight 2D platformer backend.',
    capabilities: ['velocity-integration'],
    available: true,
    step(scene, delta = 1 / 60) {
      for (const entity of scene.entities || []) {
        if (!entity.velocity) continue;
        entity.x += Number(entity.velocity.x || 0) * delta;
        entity.y += Number(entity.velocity.y || 0) * delta;
      }
      return { stepped: true, backend: 'arcade-lite', delta };
    }
  };
}

export function createAdapterBackend(id, options = {}) {
  return {
    id,
    kind: options.kind || 'adapter',
    purpose: options.purpose || `${id} adapter slot with deterministic editor fallback.`,
    capabilities: options.capabilities || DEFAULT_CAPABILITIES,
    available: Boolean(options.available),
    fallback: options.fallback || 'arcade'
  };
}

export function createNoopBackend() {
  return {
    id: 'noop',
    kind: 'test',
    purpose: 'Deterministic backend for editor previews and smoke tests.',
    capabilities: ['snapshot'],
    available: true,
    step() {
      return { stepped: false, backend: 'noop', delta: 0 };
    }
  };
}

export function createPhysicsWorld({ backend = 'arcade-lite', gravity = {}, backends = [] } = {}) {
  const registry = createPhysicsRegistry({
    backends: [
      createArcadeBackend(),
      createArcadeLiteBackend(),
      createAdapterBackend('rapier', { purpose: 'Rapier-compatible rigid body backend adapter.' }),
      createAdapterBackend('box2d', { purpose: 'Box2D-compatible rigid body backend adapter.' }),
      createAdapterBackend('box2d-wasm', { purpose: 'Box2D WASM-compatible rigid body backend adapter.', fallback: 'box2d' }),
      createNoopBackend(),
      ...backends
    ]
  });
  registry.useBackend(backend);

  const state = {
    gravity: normalizeVector(gravity),
    bodies: new Map(),
    constraints: new Map(),
    lastStep: null,
    lastRaycasts: []
  };

  const api = {
    registry,
    addBody(body = {}) {
      const normalized = normalizeBody(body, state.bodies.size);
      state.bodies.set(normalized.id, normalized);
      return clone(normalized);
    },
    addSensor(sensor = {}) {
      const normalized = normalizeBody({ ...sensor, sensor: true, type: sensor.type || 'static' }, state.bodies.size);
      normalized.collider.sensor = true;
      state.bodies.set(normalized.id, normalized);
      return clone(normalized);
    },
    addConstraint(constraint = {}) {
      const normalized = normalizeConstraint(constraint, state.constraints.size);
      state.constraints.set(normalized.id, normalized);
      return clone(normalized);
    },
    getBody(id) {
      return state.bodies.has(id) ? clone(state.bodies.get(id)) : null;
    },
    listBodies() {
      return [...state.bodies.values()].map(clone);
    },
    listConstraints() {
      return [...state.constraints.values()].map(clone);
    },
    setGravity(vector = {}) {
      state.gravity = normalizeVector(vector);
      return { ...state.gravity };
    },
    step(sceneOrDelta, maybeDelta) {
      if (sceneOrDelta && typeof sceneOrDelta === 'object' && Array.isArray(sceneOrDelta.entities)) {
        return registry.getActiveBackend().step?.(sceneOrDelta, maybeDelta) || { stepped: false, backend: api.activeBackend, delta: 0 };
      }
      const delta = Math.max(0, Number(sceneOrDelta ?? 1 / 60) || 0);
      const active = registry.getActiveBackend();
      if (active?.id === 'noop') {
        state.lastStep = { stepped: false, backend: 'noop', delta: 0, contacts: [], sensors: [], constraints: [] };
        return clone(state.lastStep);
      }

      for (const body of state.bodies.values()) {
        if (body.type !== 'dynamic') continue;
        body.velocity.x += state.gravity.x * delta;
        body.velocity.y += state.gravity.y * delta;
        body.x += body.velocity.x * delta;
        body.y += body.velocity.y * delta;
      }

      const interactions = collectInteractions([...state.bodies.values()]);
      state.lastStep = {
        stepped: true,
        backend: active?.id || 'arcade',
        delta,
        contacts: interactions.contacts,
        sensors: interactions.sensors,
        constraints: [...state.constraints.values()].map(clone)
      };
      return clone(state.lastStep);
    },
    raycast(origin = {}, direction = {}, maxDistance = Number.POSITIVE_INFINITY) {
      const hit = raycastBodies([...state.bodies.values()], origin, direction, maxDistance);
      state.lastRaycasts.push({ origin: normalizeVector(origin), direction: normalizeVector(direction, { x: 1, y: 0 }), maxDistance, hit });
      return hit ? clone(hit) : null;
    },
    debugDraw() {
      return createDebugDrawPayload([...state.bodies.values()], [...state.constraints.values()]);
    },
    createDiagnosticsSnapshot({ raycasts = [] } = {}) {
      const interactions = state.lastStep || {
        contacts: collectInteractions([...state.bodies.values()]).contacts,
        sensors: collectInteractions([...state.bodies.values()]).sensors
      };
      const raycastReports = raycasts.map((probe, index) => {
        const normalized = normalizeRaycastProbe(probe, index);
        return {
          ...normalized,
          hit: raycastBodies([...state.bodies.values()], normalized.origin, normalized.direction, normalized.maxDistance)
        };
      });
      const bodies = [...state.bodies.values()].map(clone);
      const constraints = [...state.constraints.values()].map(clone);
      const debugDraw = createDebugDrawPayload(bodies, constraints);
      return {
        schema: 'omnicore.physics-runtime-diagnostics.v1',
        backend: api.activeBackend,
        summary: createSummary({
          bodies,
          constraints,
          contacts: interactions.contacts || [],
          sensors: interactions.sensors || [],
          raycasts: raycastReports,
          debugDraw
        }),
        bodies,
        constraints,
        contacts: interactions.contacts || [],
        sensors: interactions.sensors || [],
        raycasts: raycastReports,
        debugDraw,
        backendCapabilities: {
          active: api.activeBackend,
          backends: registry.listBackends()
        },
        crossEngineProfile: {
          label: 'Phaser Arcade + Godot/Cocos debug workflow + Box2D/Rapier adapter slots',
          capabilities: [
            'arcade-contacts',
            'sensor-overlap-events',
            'raycast-probes',
            'constraint-audit',
            'editor-debug-draw',
            'backend-capability-report'
          ]
        }
      };
    },
    switchBackend(id) {
      return registry.useBackend(id);
    },
    listBackends() {
      return registry.listBackends();
    },
    get activeBackend() {
      return registry.getActiveBackend()?.id || null;
    }
  };

  return api;
}

function normalizeBackendDescriptor(backend) {
  return {
    ...backend,
    capabilities: Array.isArray(backend.capabilities) ? backend.capabilities.map(String) : [],
    available: backend.available !== false
  };
}

function normalizeBody(body = {}, index = 0) {
  const collider = body.collider || {};
  const radius = positiveNumber(collider.radius ?? body.radius, 0);
  const width = positiveNumber(collider.width ?? body.width ?? (radius ? radius * 2 : 1), 1);
  const height = positiveNumber(collider.height ?? body.height ?? (radius ? radius * 2 : 1), 1);
  const shape = collider.shape || (radius ? 'circle' : 'box');
  const sensor = Boolean(body.sensor || collider.sensor);
  return {
    ...clone(body),
    id: String(body.id || `body-${index + 1}`),
    type: body.type || (body.static ? 'static' : 'dynamic'),
    x: Number(body.x ?? body.position?.x ?? 0),
    y: Number(body.y ?? body.position?.y ?? 0),
    width,
    height,
    radius,
    sensor,
    velocity: {
      x: Number(body.velocity?.x ?? body.vx ?? 0),
      y: Number(body.velocity?.y ?? body.vy ?? 0)
    },
    collider: {
      ...clone(collider),
      shape,
      width,
      height,
      radius,
      sensor
    }
  };
}

function normalizeConstraint(constraint = {}, index = 0) {
  return {
    id: String(constraint.id || `constraint-${index + 1}`),
    type: constraint.type || 'distance',
    bodyA: constraint.bodyA || constraint.a || null,
    bodyB: constraint.bodyB || constraint.b || null,
    limits: clone(constraint.limits || {}),
    stiffness: Number(constraint.stiffness ?? 1)
  };
}

function normalizeRaycastProbe(probe = {}, index = 0) {
  return {
    id: String(probe.id || `raycast-${index + 1}`),
    origin: normalizeVector(probe.origin),
    direction: normalizeVector(probe.direction, { x: 1, y: 0 }),
    maxDistance: positiveNumber(probe.maxDistance, Number.POSITIVE_INFINITY)
  };
}

function collectInteractions(bodies) {
  const contacts = [];
  const sensors = [];
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const left = bodies[i];
      const right = bodies[j];
      if (!intersects(left, right)) continue;
      if (left.sensor || right.sensor) {
        const sensor = left.sensor ? left : right;
        const body = left.sensor ? right : left;
        if (body.type === 'dynamic' || body.type === 'kinematic') {
          sensors.push({ sensorId: sensor.id, bodyId: body.id, bodyA: left.id, bodyB: right.id });
        }
      } else {
        contacts.push({ bodyA: left.id, bodyB: right.id });
      }
    }
  }
  return { contacts, sensors };
}

function createDebugDrawPayload(bodies, constraints) {
  return {
    schema: 'omnicore.physics-debug-draw.v1',
    colliders: bodies.map((body) => ({
      id: body.id,
      type: body.type,
      shape: body.collider.shape,
      x: body.x,
      y: body.y,
      width: body.width,
      height: body.height,
      radius: body.radius,
      sensor: body.sensor
    })),
    constraints: constraints.map((constraint) => ({
      id: constraint.id,
      type: constraint.type,
      bodyA: constraint.bodyA,
      bodyB: constraint.bodyB,
      limits: clone(constraint.limits)
    }))
  };
}

function createSummary({ bodies, constraints, contacts, sensors, raycasts, debugDraw }) {
  return {
    bodyCount: bodies.length,
    dynamicBodyCount: bodies.filter((body) => body.type === 'dynamic').length,
    staticBodyCount: bodies.filter((body) => body.type !== 'dynamic').length,
    sensorCount: bodies.filter((body) => body.sensor).length,
    constraintCount: constraints.length,
    contactCount: contacts.length,
    sensorEventCount: sensors.length,
    raycastCount: raycasts.length,
    raycastHitCount: raycasts.filter((raycast) => raycast.hit).length,
    debugColliderCount: debugDraw.colliders.length
  };
}

function raycastBodies(bodies, origin = {}, direction = {}, maxDistance = Number.POSITIVE_INFINITY) {
  const start = normalizeVector(origin);
  const dir = normalizeDirection(direction);
  let closest = null;
  for (const body of bodies) {
    const distance = rayAabbDistance(start, dir, bodyAabb(body), maxDistance);
    if (distance == null) continue;
    if (!closest || distance < closest.distance) {
      closest = {
        bodyId: body.id,
        distance,
        point: {
          x: start.x + dir.x * distance,
          y: start.y + dir.y * distance
        },
        sensor: body.sensor
      };
    }
  }
  return closest;
}

function rayAabbDistance(origin, direction, aabb, maxDistance) {
  const tx1 = direction.x === 0 ? -Infinity : (aabb.minX - origin.x) / direction.x;
  const tx2 = direction.x === 0 ? Infinity : (aabb.maxX - origin.x) / direction.x;
  const ty1 = direction.y === 0 ? -Infinity : (aabb.minY - origin.y) / direction.y;
  const ty2 = direction.y === 0 ? Infinity : (aabb.maxY - origin.y) / direction.y;
  const tMin = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2), 0);
  const tMax = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2), maxDistance);
  if (tMax < tMin) return null;
  return Number(tMin.toFixed(6));
}

function intersects(left, right) {
  const a = bodyAabb(left);
  const b = bodyAabb(right);
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function bodyAabb(body) {
  return {
    minX: body.x,
    minY: body.y,
    maxX: body.x + body.width,
    maxY: body.y + body.height
  };
}

function normalizeDirection(vector = {}) {
  const raw = normalizeVector(vector, { x: 1, y: 0 });
  const length = Math.hypot(raw.x, raw.y) || 1;
  return {
    x: raw.x / length,
    y: raw.y / length
  };
}

function normalizeVector(vector = {}, fallback = { x: 0, y: 0 }) {
  return {
    x: Number(vector.x ?? fallback.x ?? 0),
    y: Number(vector.y ?? fallback.y ?? 0)
  };
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
