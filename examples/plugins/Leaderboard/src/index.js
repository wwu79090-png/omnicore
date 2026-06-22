export default {
  name: 'Leaderboard',
  version: '1.0.0',
  install({ namespace = 'omnicore', adapter = null } = {}) {
    const store = adapter || createMemoryAdapter(namespace);
    return {
      async submit(boardId, entry = {}) {
        const record = normalizeEntry(entry);
        await store.submit(boardId, record);
        return record;
      },
      async top(boardId, limit = 10) {
        return store.top(boardId, limit);
      },
      async rank(boardId, playerId) {
        const entries = await store.top(boardId, 1000);
        const index = entries.findIndex((entry) => entry.playerId === playerId);
        return index === -1 ? null : index + 1;
      },
      destroy() {}
    };
  }
};

function normalizeEntry(entry = {}) {
  return {
    playerId: String(entry.playerId || entry.name || 'guest'),
    score: Number(entry.score || 0),
    meta: JSON.parse(JSON.stringify(entry.meta || {})),
    submittedAt: entry.submittedAt || new Date().toISOString()
  };
}

function createMemoryAdapter(namespace) {
  const memory = new Map();
  const prefix = `${namespace}:leaderboard:`;
  const readBoard = (boardId) => {
    const key = `${prefix}${boardId}`;
    if (memory.has(key)) return memory.get(key);
    const raw = globalThis.localStorage?.getItem?.(key);
    const parsed = raw ? JSON.parse(raw) : [];
    memory.set(key, parsed);
    return parsed;
  };
  const writeBoard = (boardId, entries) => {
    const key = `${prefix}${boardId}`;
    memory.set(key, entries);
    globalThis.localStorage?.setItem?.(key, JSON.stringify(entries));
  };
  return {
    async submit(boardId, entry) {
      const entries = readBoard(boardId)
        .filter((item) => item.playerId !== entry.playerId)
        .concat(entry)
        .sort((left, right) => right.score - left.score);
      writeBoard(boardId, entries);
    },
    async top(boardId, limit) {
      return readBoard(boardId).slice(0, limit);
    }
  };
}
