export default {
  name: 'SaveCloud',
  version: '1.0.0',
  install({ namespace = 'omnicore', adapter = null } = {}) {
    const storage = adapter || createLocalFirstAdapter(namespace);
    return {
      async save(slot, data) {
        const payload = {
          slot,
          savedAt: new Date().toISOString(),
          data: JSON.parse(JSON.stringify(data ?? null))
        };
        await storage.save(slot, payload);
        return payload;
      },
      async load(slot) {
        const payload = await storage.load(slot);
        return payload?.data ?? null;
      },
      async list() {
        return storage.list();
      },
      async remove(slot) {
        return storage.remove?.(slot);
      },
      destroy() {}
    };
  }
};

function createLocalFirstAdapter(namespace) {
  const memory = new Map();
  const prefix = `${namespace}:save:`;
  const local = globalThis.localStorage;
  return {
    async save(slot, payload) {
      memory.set(slot, payload);
      local?.setItem?.(`${prefix}${slot}`, JSON.stringify(payload));
    },
    async load(slot) {
      const raw = local?.getItem?.(`${prefix}${slot}`);
      if (raw) return JSON.parse(raw);
      return memory.get(slot) || null;
    },
    async list() {
      const slots = new Set(memory.keys());
      if (local) {
        for (let index = 0; index < local.length; index += 1) {
          const key = local.key(index);
          if (key?.startsWith(prefix)) slots.add(key.slice(prefix.length));
        }
      }
      return [...slots].sort();
    },
    async remove(slot) {
      memory.delete(slot);
      local?.removeItem?.(`${prefix}${slot}`);
    }
  };
}
