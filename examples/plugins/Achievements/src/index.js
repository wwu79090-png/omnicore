export default {
  name: 'Achievements',
  version: '1.0.0',
  install({ definitions = [], bus = null, namespace = 'omnicore' } = {}) {
    const registry = new Map(definitions.map((definition) => [definition.id, normalizeDefinition(definition)]));
    const state = new Map();
    return {
      registerProvider(nextDefinitions = []) {
        for (const definition of nextDefinitions) registry.set(definition.id, normalizeDefinition(definition));
        return this;
      },
      progress(id, amount = 1) {
        const definition = registry.get(id);
        if (!definition) return null;
        const current = state.get(id) || { id, value: 0, unlocked: false };
        current.value = Math.min(definition.target, current.value + Number(amount || 0));
        current.unlocked = current.unlocked || current.value >= definition.target;
        state.set(id, current);
        persist(namespace, state);
        if (current.unlocked) bus?.emit?.('achievement:unlock', { id, definition });
        return { ...current };
      },
      isUnlocked(id) {
        return Boolean(state.get(id)?.unlocked);
      },
      list() {
        return [...registry.values()].map((definition) => ({
          ...definition,
          progress: state.get(definition.id)?.value || 0,
          unlocked: Boolean(state.get(definition.id)?.unlocked)
        }));
      },
      destroy() {}
    };
  }
};

function normalizeDefinition(definition = {}) {
  return {
    id: String(definition.id || definition.title || 'achievement'),
    title: definition.title || definition.id || 'Achievement',
    description: definition.description || '',
    target: Math.max(1, Number(definition.target || 1)),
    hidden: Boolean(definition.hidden)
  };
}

function persist(namespace, state) {
  const payload = [...state.values()];
  globalThis.localStorage?.setItem?.(`${namespace}:achievements`, JSON.stringify(payload));
}
