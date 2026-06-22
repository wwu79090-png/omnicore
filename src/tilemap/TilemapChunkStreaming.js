function chunkKey(x, y) {
  return `${x},${y}`;
}

function parseChunkKey(key) {
  const [x, y] = String(key).split(',').map((value) => Number(value));
  return { x, y };
}

function inBounds(x, y, width, height) {
  if (Number.isFinite(Number(width)) && x >= Number(width)) return false;
  if (Number.isFinite(Number(height)) && y >= Number(height)) return false;
  return x >= 0 && y >= 0;
}

/**
 * Computes tilemap chunks that should load, remain resident, or unload.
 */
export function createTilemapChunkStreamPlan({
  viewport = {},
  chunkSize = 16,
  loadedChunks = [],
  preloadRadius = 1,
  mapWidth = Infinity,
  mapHeight = Infinity
} = {}) {
  const size = Math.max(1, Number(chunkSize) || 16);
  const minX = Math.floor((Number(viewport.x) || 0) / size);
  const minY = Math.floor((Number(viewport.y) || 0) / size);
  const maxX = Math.floor(((Number(viewport.x) || 0) + Math.max(0, Number(viewport.width) || 0) - 1) / size);
  const maxY = Math.floor(((Number(viewport.y) || 0) + Math.max(0, Number(viewport.height) || 0) - 1) / size);
  const radius = Math.max(0, Math.round(Number(preloadRadius) || 0));
  const loaded = new Set(loadedChunks.map(String));
  const target = new Set();
  const visible = [];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!inBounds(x, y, mapWidth, mapHeight)) continue;
      visible.push(chunkKey(x, y));
    }
  }

  for (let y = minY - radius; y <= maxY + radius; y += 1) {
    for (let x = minX - radius; x <= maxX + radius; x += 1) {
      if (!inBounds(x, y, mapWidth, mapHeight)) continue;
      target.add(chunkKey(x, y));
    }
  }

  const keep = [...target].filter((key) => loaded.has(key)).sort(sortChunkKey);
  const load = [...target].filter((key) => !loaded.has(key)).sort(sortChunkKey);
  const unload = [...loaded].filter((key) => !target.has(key)).sort(sortChunkKey);
  return {
    format: 'OmniCore.TilemapChunkStreamPlan',
    chunkSize: size,
    visible: visible.sort(sortChunkKey),
    keep,
    load,
    unload,
    preloadRadius: radius,
    target: [...target].sort(sortChunkKey)
  };
}

function sortChunkKey(left, right) {
  const a = parseChunkKey(left);
  const b = parseChunkKey(right);
  return a.y - b.y || a.x - b.x;
}

export default createTilemapChunkStreamPlan;
