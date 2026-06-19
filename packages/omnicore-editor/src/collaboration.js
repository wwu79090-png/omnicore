export function createCollaborationSession({ clientId = randomId() } = {}) {
  const state = {
    clientId,
    tiles: [],
    monsters: [],
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
      monsters: state.monsters.map((item) => ({ ...item }))
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
    monsters: after.monsters.filter((item) => !before.monsters.some((old) => old.id === item.id && old.x === item.x && old.y === item.y))
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
