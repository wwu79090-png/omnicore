export function createPhysicsRegistry({ backends = [] } = {}) {
  const registry = new Map();
  let activeBackend = null;
  const api = {
    registerBackend(backend) {
      if (!backend?.id) throw new Error('physics backend id is required');
      registry.set(backend.id, backend);
      if (!activeBackend) activeBackend = backend.id;
      return backend;
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
        purpose: backend.purpose
      }));
    }
  };
  for (const backend of backends) api.registerBackend(backend);
  return api;
}

export function createArcadeLiteBackend() {
  return {
    id: 'arcade-lite',
    kind: 'javascript',
    purpose: 'Default lightweight 2D platformer backend.',
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

export function createNoopBackend() {
  return {
    id: 'noop',
    kind: 'test',
    purpose: 'Deterministic backend for editor previews and smoke tests.',
    step() {
      return { stepped: false, backend: 'noop', delta: 0 };
    }
  };
}

export function createPhysicsWorld({ backend = 'arcade-lite' } = {}) {
  const registry = createPhysicsRegistry({
    backends: [
      createArcadeLiteBackend(),
      createNoopBackend()
    ]
  });
  registry.useBackend(backend);
  return {
    registry,
    step(scene, delta) {
      return registry.getActiveBackend().step(scene, delta);
    },
    switchBackend(id) {
      return registry.useBackend(id);
    },
    get activeBackend() {
      return registry.getActiveBackend().id;
    }
  };
}
