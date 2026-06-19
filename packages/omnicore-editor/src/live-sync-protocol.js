export function createEditorState(initial = {}) {
  return {
    connected: false,
    scene: initial.scene || { name: 'untitled', entities: [] },
    selectedEntityId: initial.selectedEntityId || null,
    selectedPrefabId: initial.selectedPrefabId || null,
    gizmoMode: initial.gizmoMode || 'translate',
    collisionMode: Boolean(initial.collisionMode),
    selectedTile: initial.selectedTile ?? 1,
    prefabs: initial.prefabs || [],
    assets: initial.assets || [],
    playState: normalizePlayState(initial.playState),
    profilerFrame: normalizeProfilerFrame(initial.profilerFrame),
    database: normalizeDatabaseState(initial.database),
    lastCommandError: initial.lastCommandError || null,
    flowGraph: normalizeFlowGraph(initial.flowGraph),
    tilemap: normalizeTilemap(initial.tilemap),
    dockLayout: normalizeDockLayout(initial.dockLayout),
    simulation: initial.simulation || { active: false, physics: false, logic: false },
    animations: initial.animations || {},
    pendingCommands: initial.pendingCommands || []
  };
}

export function createLiveSyncMessage(type, payload = {}, meta = {}) {
  return {
    type,
    payload,
    meta: {
      sentAt: meta.sentAt || new Date().toISOString(),
      source: meta.source || 'omnicore-editor'
    }
  };
}

export function applyLiveSyncMessage(state = createEditorState(), message = {}) {
  const next = {
    ...state,
    scene: { ...(state.scene || { entities: [] }) },
    pendingCommands: [...(state.pendingCommands || [])]
  };
  if (message.type === 'runtime:hello') next.connected = true;
  if (message.type === 'runtime:scene') next.scene = { entities: [], ...message.payload };
  if (message.type === 'runtime:tilemap') next.tilemap = { ...next.tilemap, ...message.payload };
  if (message.type === 'runtime:play-state') next.playState = normalizePlayState(message.payload);
  if (message.type === 'runtime:profiler-frame') next.profilerFrame = normalizeProfilerFrame(message.payload);
  if (message.type === 'runtime:database') next.database = normalizeDatabaseState({ ...next.database, lastUpdate: message.payload });
  if (message.type === 'runtime:command-error') next.lastCommandError = { ...message.payload };
  if (message.type === 'runtime:prefabs') next.prefabs = Array.isArray(message.payload) ? message.payload : message.payload?.prefabs || [];
  if (message.type === 'runtime:animations') next.animations = { ...message.payload };
  if (message.type === 'editor:update-entity') next.pendingCommands.push(message.payload);
  if (message.type === 'editor:select-entity') next.selectedEntityId = message.payload?.id || null;
  if (message.type === 'editor:gizmo-mode') next.gizmoMode = message.payload?.mode || 'translate';
  if (message.type === 'editor:dock-layout') next.dockLayout = normalizeDockLayout(message.payload);
  return next;
}

export function serializeSceneForSync(scene = {}) {
  return {
    name: scene.name || 'untitled',
    entities: (scene.children || scene.entities || []).map((entity, index) => serializeEntity(entity, index))
  };
}

function normalizeTilemap(tilemap = {}) {
  const width = Number(tilemap.width || 16);
  const height = Number(tilemap.height || 12);
  const size = Math.max(0, width * height);
  const data = Array.isArray(tilemap.data) ? [...tilemap.data] : [];
  while (data.length < size) data.push(0);
  const layers = normalizeTilemapLayers(tilemap.layers, data, size);
  const activeLayerId = layers.some((layer) => layer.id === tilemap.activeLayerId)
    ? tilemap.activeLayerId
    : layers[0]?.id || 'tiles';
  return {
    width,
    height,
    tileWidth: Number(tilemap.tileWidth || tilemap.tilewidth || 16),
    tileHeight: Number(tilemap.tileHeight || tilemap.tileheight || 16),
    data: [...(layers[0]?.data || data.slice(0, size))],
    layers,
    activeLayerId,
    collisions: uniqueNumbers(tilemap.collisions),
    tilesets: normalizeTilesets(tilemap.tilesets || (tilemap.tileset ? [tilemap.tileset] : []), tilemap)
  };
}

function normalizeTilemapLayers(layers, fallbackData, size) {
  const source = Array.isArray(layers) && layers.length > 0
    ? layers
    : [{ id: 'tiles', name: 'tiles', data: fallbackData }];
  return source.map((layer, index) => {
    const data = Array.isArray(layer.data) ? [...layer.data] : [];
    while (data.length < size) data.push(0);
    return {
      id: String(layer.id || layer.name || `layer-${index + 1}`),
      name: String(layer.name || layer.id || `Layer ${index + 1}`),
      visible: layer.visible !== false,
      opacity: Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 1,
      data: data.slice(0, size)
    };
  });
}

function normalizeTilesets(tilesets, tilemap = {}) {
  return (Array.isArray(tilesets) ? tilesets : []).map((tileset, index) => {
    const tileWidth = Number(tileset.tileWidth || tileset.tilewidth || tilemap.tileWidth || tilemap.tilewidth || 16);
    const tileHeight = Number(tileset.tileHeight || tileset.tileheight || tilemap.tileHeight || tilemap.tileheight || 16);
    const firstgid = Number(tileset.firstgid || 1);
    const columns = Math.max(1, Number(tileset.columns || 1));
    const collisionTiles = uniqueNumbers(tileset.collisionTiles || tileset.solidTiles);
    const explicitTiles = Array.isArray(tileset.tiles) ? tileset.tiles : [];
    const tilecount = Math.max(
      Number(tileset.tilecount || tileset.tileCount || 0),
      explicitTiles.length,
      collisionTiles.length ? Math.max(...collisionTiles) - firstgid + 1 : 0
    );
    const byId = new Map();
    for (let offset = 0; offset < tilecount; offset += 1) {
      const id = firstgid + offset;
      byId.set(id, { id, solid: collisionTiles.includes(id), source: cropTile(id, { firstgid, columns, tileWidth, tileHeight }) });
    }
    for (const tile of explicitTiles) {
      const id = Number(tile.id ?? tile.gid);
      if (!Number.isFinite(id)) continue;
      byId.set(id, {
        ...byId.get(id),
        ...tile,
        id,
        solid: Boolean(tile.solid || tile.collision || collisionTiles.includes(id)),
        source: tile.source || cropTile(id, { firstgid, columns, tileWidth, tileHeight })
      });
    }
    return {
      name: String(tileset.name || `tileset-${index + 1}`),
      image: tileset.image || null,
      firstgid,
      columns,
      tileWidth,
      tileHeight,
      tilecount,
      collisionTiles,
      tiles: [...byId.values()]
    };
  });
}

function cropTile(tileId, tileset) {
  const local = Math.max(0, Number(tileId) - Number(tileset.firstgid || 1));
  const columns = Math.max(1, Number(tileset.columns || 1));
  const width = Number(tileset.tileWidth || 16);
  const height = Number(tileset.tileHeight || 16);
  return {
    x: (local % columns) * width,
    y: Math.floor(local / columns) * height,
    width,
    height
  };
}

function uniqueNumbers(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value)))];
}

function normalizePlayState(playState = {}) {
  const mode = ['editing', 'playing', 'paused'].includes(playState.mode) ? playState.mode : 'editing';
  return {
    ...playState,
    mode,
    frame: Number(playState.frame || 0),
    startedAt: playState.startedAt || null,
    pausedAt: playState.pausedAt || null,
    lastCommandId: playState.lastCommandId || null
  };
}

function normalizeProfilerFrame(frame = null) {
  if (!frame) return null;
  return {
    frame: Number(frame.frame || 0),
    time: Number(frame.time || 0),
    totalMs: Number(frame.totalMs || 0),
    sections: Array.isArray(frame.sections)
      ? frame.sections.map((section) => ({
        ...section,
        name: section.name || 'unknown',
        duration: Number(section.duration || 0)
      }))
      : []
  };
}

function normalizeDatabaseState(database = {}) {
  return {
    tables: database.tables || {},
    lastUpdate: database.lastUpdate || null
  };
}

function serializeEntity(entity = {}, index = 0) {
  const output = {};
  const seen = new WeakSet();
  for (const [key, value] of Object.entries(entity)) {
    if (key === 'parent' || key === 'game' || key === 'displayObject' || key.startsWith('__')) continue;
    const serialized = serializeValue(value, seen);
    if (serialized !== undefined) output[key] = serialized;
  }
  return {
    ...output,
    id: output.id || output.name || `entity-${index}`,
    name: output.name || output.id || `Entity ${index + 1}`,
    type: output.type || 'entity',
    texture: output.texture || output.sprite || null,
    x: output.x ?? 0,
    y: output.y ?? 0,
    width: output.width ?? 0,
    height: output.height ?? 0,
    rotation: output.rotation ?? 0,
    scaleX: output.scaleX ?? output.scale ?? 1,
    scaleY: output.scaleY ?? output.scale ?? 1
  };
}

function serializeValue(value, seen) {
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => serializeValue(item, seen))
      .filter((item) => item !== undefined);
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'parent' && key !== 'game' && key !== 'displayObject' && !key.startsWith('__'))
      .map(([key, item]) => [key, serializeValue(item, seen)])
      .filter(([, item]) => item !== undefined)
  );
}

function normalizeDockLayout(layout = {}) {
  const fallback = {
    left: ['hierarchy', 'prefabs', 'assets'],
    center: ['scene-view'],
    right: ['inspector'],
    bottom: ['animation-timeline', 'tilemap', 'flow-graph', 'profiler']
  };
  return Object.fromEntries(
    Object.entries(fallback).map(([region, panels]) => [
      region,
      Array.isArray(layout[region]) && layout[region].length ? [...layout[region]] : [...panels]
    ])
  );
}

function normalizeFlowGraph(flowGraph = {}) {
  return {
    nodes: (flowGraph.nodes || []).map((node, index) => ({
      id: node.id || `node-${index + 1}`,
      type: node.type || 'action',
      label: node.label || node.id || `Node ${index + 1}`,
      x: Number(node.x || 0),
      y: Number(node.y || 0),
      scope: { ...(node.scope || {}) },
      data: { ...(node.data || {}) }
    })),
    edges: (flowGraph.edges || [])
      .filter((edge) => edge?.from && edge?.to)
      .map((edge) => ({ from: edge.from, to: edge.to }))
  };
}
