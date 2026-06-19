export function createEntity({ id, name = id, type = 'entity', x = 0, y = 0, ...props } = {}) {
  if (!id) throw new Error('entity id is required');
  return {
    id,
    name,
    type,
    x: Number(x),
    y: Number(y),
    ...props
  };
}

export function createScene({ name = 'scene', entities = [] } = {}) {
  const scene = {
    name,
    entities: [],
    add(entity) {
      this.entities.push(entity);
      return entity;
    },
    findEntity(id) {
      return this.entities.find((entity) => entity.id === id) || null;
    },
    toJSON() {
      return {
        name: this.name,
        entityCount: this.entities.length,
        entities: this.entities.map((entity) => ({ ...entity }))
      };
    }
  };
  for (const entity of entities) scene.add(entity);
  return scene;
}

export function createExtensionHost() {
  const slots = new Map();
  return {
    register(slot) {
      if (!slot?.id) throw new Error('extension slot id is required');
      slots.set(slot.id, slot);
      return slot;
    },
    get(id) {
      return slots.get(id) || null;
    },
    describe() {
      return [...slots.values()].map((slot) => ({
        id: slot.id,
        kind: slot.kind,
        purpose: slot.purpose
      }));
    }
  };
}

export function createWasmExtensionSlot({ loader = null } = {}) {
  return {
    id: '@omnicore/core/wasm-slot',
    kind: 'wasm',
    purpose: 'Wasm runtime modules can mount compute-heavy systems without changing scene code.',
    async load(options = {}) {
      if (typeof loader === 'function') return loader(options);
      return {
        loaded: false,
        reason: 'no wasm loader configured'
      };
    }
  };
}

export function createHelloScene() {
  return createScene({
    name: 'hello-scene',
    entities: [
      createEntity({ id: 'hero', name: 'Hero', type: 'player', x: 16, y: 24, velocity: { x: 0, y: 0 } }),
      createEntity({ id: 'ground', name: 'Ground', type: 'platform', x: 0, y: 96, width: 160, height: 16 })
    ]
  });
}
