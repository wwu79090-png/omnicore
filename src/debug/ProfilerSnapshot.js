export class ProfilerSnapshot {
  static capture(game = {}, options = {}) {
    const entities = collectEntities(game.scene || game.currentScene || game, options)
      .map((entity, index) => snapshotEntity(entity, index))
      .sort((left, right) => right.estimatedBytes - left.estimatedBytes);
    return {
      schema: 'OmniCore.Profiler.Snapshot/v1',
      generatedAt: options.generatedAt || new Date().toISOString(),
      entityCount: entities.length,
      totalEstimatedBytes: entities.reduce((sum, entity) => sum + entity.estimatedBytes, 0),
      entities
    };
  }

  static installDebugShortcut(game = {}, { window: ownerWindow = globalThis.window } = {}) {
    if (!game?.config?.debug || !ownerWindow?.addEventListener) {
      return { destroy() {} };
    }
    game.profilerSnapshot = game.profilerSnapshot || { latest: null };
    const onKeyDown = (event) => {
      if (event.key !== 'F2') return;
      event.preventDefault?.();
      const snapshot = ProfilerSnapshot.capture(game);
      game.profilerSnapshot.latest = snapshot;
      game.events?.emit?.('profiler:snapshot', snapshot);
      game.logger?.info?.('ProfilerSnapshot', 'F2 runtime memory snapshot captured', snapshot);
    };
    ownerWindow.addEventListener('keydown', onKeyDown);
    return {
      destroy() {
        ownerWindow.removeEventListener?.('keydown', onKeyDown);
      }
    };
  }
}

function collectEntities(sceneLike = {}, options = {}) {
  if (Array.isArray(options.entities)) return options.entities;
  if (Array.isArray(sceneLike.entities)) return sceneLike.entities;
  if (Array.isArray(sceneLike.children)) return sceneLike.children;
  if (Array.isArray(sceneLike.current?.entities)) return sceneLike.current.entities;
  if (Array.isArray(sceneLike.current?.children)) return sceneLike.current.children;
  if (Array.isArray(sceneLike.active?.entities)) return sceneLike.active.entities;
  if (Array.isArray(sceneLike.active?.children)) return sceneLike.active.children;
  return [];
}

function snapshotEntity(entity = {}, index = 0) {
  const components = collectComponents(entity).map(snapshotComponent);
  const ownBytes = estimateBytes({
    id: entity.id,
    name: entity.name,
    type: entity.type,
    x: entity.x,
    y: entity.y,
    width: entity.width,
    height: entity.height,
    zIndex: entity.zIndex
  });
  const estimatedBytes = ownBytes + components.reduce((sum, component) => sum + component.estimatedBytes, 0);
  return {
    id: entity.id || entity.name || `entity-${index}`,
    name: entity.name || entity.id || `Entity ${index + 1}`,
    type: entity.type || entity.constructor?.name || 'Entity',
    componentCount: components.length,
    estimatedBytes,
    components
  };
}

function collectComponents(entity = {}) {
  if (Array.isArray(entity.components)) return entity.components;
  if (entity.components instanceof Map) return [...entity.components.values()];
  if (entity.componentMap instanceof Map) return [...entity.componentMap.values()];
  if (entity._components instanceof Map) return [...entity._components.values()];
  if (Array.isArray(entity._components)) return entity._components;
  return [];
}

function snapshotComponent(component = {}) {
  return {
    name: component.name || component.type || component.constructor?.name || 'Component',
    estimatedBytes: estimateBytes(component)
  };
}

function estimateBytes(value, seen = new WeakSet()) {
  if (value == null) return 0;
  const kind = typeof value;
  if (kind === 'boolean') return 4;
  if (kind === 'number') return 8;
  if (kind === 'string') return value.length * 2;
  if (kind === 'function') return 0;
  if (kind !== 'object') return 0;
  if (seen.has(value)) return 0;
  seen.add(value);
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + estimateBytes(item, seen), 24);
  if (value instanceof Map) {
    return [...value.entries()].reduce((sum, [key, item]) => sum + estimateBytes(key, seen) + estimateBytes(item, seen), 32);
  }
  return Object.entries(value).reduce((sum, [key, item]) => sum + key.length * 2 + estimateBytes(item, seen), 32);
}

export default ProfilerSnapshot;
