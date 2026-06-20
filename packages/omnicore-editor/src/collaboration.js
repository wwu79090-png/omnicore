export function createCollaborationSession({ clientId = randomId() } = {}) {
  const state = {
    clientId,
    tiles: [],
    monsters: [],
    locks: new Map(),
    branches: new Map(),
    activeBranch: 'main',
    version: 0,
    listeners: new Set()
  };

  const api = {
    clientId,
    transact(callback) {
      const before = snapshot();
      callback?.(docApi);
      state.version += 1;
      const update = encodeUpdate(diffSnapshots(before, snapshot()));
      notify(update);
      return update;
    },
    applyUpdate(update) {
      const decoded = decodeUpdate(update);
      for (const tile of decoded.tiles || []) upsert(state.tiles, tile, (item) => `${item.x}:${item.y}`);
      for (const monster of decoded.monsters || []) upsert(state.monsters, monster, (item) => item.id);
      for (const lock of decoded.locks || []) state.locks.set(lock.objectId, { ...lock });
      for (const branch of decoded.branches || []) state.branches.set(branch.name, { ...branch });
      if (decoded.activeBranch) state.activeBranch = decoded.activeBranch;
      state.version = Math.max(state.version + 1, decoded.version || 0);
      notify(update);
      return api;
    },
    encodeStateAsUpdate() {
      return encodeUpdate(snapshot());
    },
    onUpdate(listener) {
      state.listeners.add(listener);
      return () => state.listeners.delete(listener);
    },
    lockObject(objectId, meta = {}) {
      const existing = state.locks.get(objectId);
      if (existing && existing.owner !== clientId) {
        return { ok: false, objectId, owner: existing.owner };
      }
      const lock = {
        objectId,
        owner: clientId,
        lockedAt: meta.lockedAt || new Date().toISOString()
      };
      state.locks.set(objectId, lock);
      notify(encodeUpdate({ clientId, version: state.version, locks: [lock] }));
      return { ok: true, ...lock };
    },
    unlockObject(objectId) {
      const existing = state.locks.get(objectId);
      if (existing && existing.owner !== clientId) return { ok: false, objectId, owner: existing.owner };
      state.locks.delete(objectId);
      notify(encodeUpdate({ clientId, version: state.version, locks: [] }));
      return { ok: true, objectId };
    },
    createVersionBranch(name, { storage = 'indexeddb+git' } = {}) {
      const branch = {
        name,
        storage,
        createdBy: clientId,
        createdAt: new Date().toISOString(),
        snapshot: snapshot()
      };
      state.branches.set(name, branch);
      state.activeBranch = name;
      notify(encodeUpdate({ clientId, version: state.version, branches: [branch], activeBranch: name }));
      return branch;
    },
    rollbackBranch(name) {
      const branch = state.branches.get(name);
      if (!branch) return null;
      state.tiles = branch.snapshot.tiles.map((item) => ({ ...item }));
      state.monsters = branch.snapshot.monsters.map((item) => ({ ...item }));
      state.activeBranch = name;
      state.version += 1;
      notify(encodeUpdate(snapshot()));
      return snapshot();
    },
    snapshot
  };

  const docApi = {
    placeTile(tile) {
      upsert(state.tiles, tile, (item) => `${item.x}:${item.y}`);
    },
    placeMonster(monster) {
      upsert(state.monsters, monster, (item) => item.id);
    }
  };

  function snapshot() {
    return {
      clientId,
      version: state.version,
      tiles: state.tiles.map((item) => ({ ...item })),
      monsters: state.monsters.map((item) => ({ ...item })),
      locks: [...state.locks.values()].map((item) => ({ ...item })),
      branches: [...state.branches.values()].map((item) => ({ ...item })),
      activeBranch: state.activeBranch
    };
  }

  function notify(update) {
    for (const listener of state.listeners) listener(update);
  }

  return api;
}

function encodeUpdate(payload) {
  return {
    protocol: 'yjs-update-v1',
    update: new TextEncoder().encode(JSON.stringify(payload)),
    ...payload
  };
}

function decodeUpdate(update = {}) {
  if (update.update instanceof Uint8Array) {
    return JSON.parse(new TextDecoder().decode(update.update));
  }
  return update;
}

function diffSnapshots(before, after) {
  return {
    clientId: after.clientId,
    version: after.version,
    tiles: after.tiles.filter((item) => !before.tiles.some((old) => old.x === item.x && old.y === item.y && old.tileId === item.tileId)),
    monsters: after.monsters.filter((item) => !before.monsters.some((old) => old.id === item.id && old.x === item.x && old.y === item.y)),
    locks: after.locks.filter((item) => !before.locks.some((old) => old.objectId === item.objectId && old.owner === item.owner)),
    branches: after.branches.filter((item) => !before.branches.some((old) => old.name === item.name)),
    activeBranch: after.activeBranch
  };
}

function upsert(list, item, keyFn) {
  const key = keyFn(item);
  const index = list.findIndex((entry) => keyFn(entry) === key);
  if (index >= 0) list[index] = { ...list[index], ...item };
  else list.push({ ...item });
}

function randomId() {
  return Math.random().toString(36).slice(2);
}

export default createCollaborationSession;
