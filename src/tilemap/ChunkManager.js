import ChunkCache from './ChunkCache.js';

/**
 * Runtime chunk loader/unloader for OmniCore.Tilemap.
 *
 * Chunks are generated in pixel-sized windows so a 16px tile map with
 * `chunkPixelSize: 64` produces 4x4 tile chunks.
 *
 * @example
 * const manager = new ChunkManager(tilemap, { chunkPixelSize: 64 });
 * manager.update(cameraViewport);
 */
export class ChunkManager {
  constructor(tilemap, {
    cache = new ChunkCache(),
    chunkPixelSize = 64,
    unloadDistance = 0,
    mode = 'disable',
    collisionTileIds = []
  } = {}) {
    this.tilemap = tilemap;
    this.cache = cache;
    this.chunkPixelSize = chunkPixelSize;
    this.unloadDistance = unloadDistance;
    this.mode = mode;
    this.collisionTileIds = new Set(collisionTileIds);
    this.activeChunks = new Map();
    this.chunks = this._buildChunks();
  }

  updateAroundPlayer(player = {}) {
    const centerX = Math.floor(Number(player.x || 0) / this.chunkPixelSize);
    const centerY = Math.floor(Number(player.y || 0) / this.chunkPixelSize);
    const nextActive = new Map();
    for (let y = centerY - 1; y <= centerY + 1; y += 1) {
      for (let x = centerX - 1; x <= centerX + 1; x += 1) {
        const key = `infinite:${x}:${y}`;
        const chunk = this.activeChunks.get(key) || {
          key,
          x,
          y,
          width: 1,
          height: 1,
          bounds: {
            x: x * this.chunkPixelSize,
            y: y * this.chunkPixelSize,
            width: this.chunkPixelSize,
            height: this.chunkPixelSize
          },
          data: [],
          disabled: false
        };
        nextActive.set(key, chunk);
        this.cache.set(key, chunk);
      }
    }
    for (const [key, chunk] of this.activeChunks.entries()) {
      const dx = Math.abs(chunk.x - centerX);
      const dy = Math.abs(chunk.y - centerY);
      if (dx <= this.unloadDistance && dy <= this.unloadDistance && !nextActive.has(key)) {
        nextActive.set(key, chunk);
      } else if (dx > this.unloadDistance || dy > this.unloadDistance) {
        this.cache.release(key);
      }
    }
    this.activeChunks = nextActive;
    return [...this.activeChunks.values()].filter((chunk) => Math.abs(chunk.x - centerX) <= 1 && Math.abs(chunk.y - centerY) <= 1);
  }

  update(viewport) {
    const activeBounds = pad(viewport, this.unloadDistance);
    const nextActive = new Map();
    for (const chunk of this.chunks) {
      const { key } = chunk;
      if (intersects(chunk.bounds, viewport)) {
        this._hydrate(chunk);
        chunk.disabled = false;
        chunk.lowResolution = false;
        chunk.released = false;
        nextActive.set(key, chunk);
        this.cache.set(key, chunk);
      } else if (!intersects(chunk.bounds, activeBounds)) {
        this._unload(key, chunk);
      } else if (this.mode === 'lowres') {
        chunk.lowResolution = true;
        nextActive.set(key, chunk);
        this.cache.set(key, chunk);
      }
    }
    this.activeChunks = nextActive;
    return [...this.activeChunks.values()];
  }

  getRenderableTiles() {
    const tiles = [];
    for (const chunk of this.activeChunks.values()) {
      if (!chunk.data || chunk.disabled) continue;
      for (let index = 0; index < chunk.data.length; index += 1) {
        const tileId = chunk.data[index];
        if (!tileId) continue;
        const localX = index % chunk.width;
        const localY = Math.floor(index / chunk.width);
        tiles.push(this._tileRecord(chunk, localX, localY, tileId));
      }
    }
    return tiles;
  }

  getCollisionObjects() {
    return this.getRenderableTiles()
      .filter((tile) => !this.collisionTileIds.size || this.collisionTileIds.has(tile.tileId))
      .map((tile) => ({
        id: `${tile.layer}:${tile.tileX}:${tile.tileY}`,
        name: `tile-${tile.tileId}`,
        type: 'tile',
        tileId: tile.tileId,
        x: tile.x,
        y: tile.y,
        width: tile.width,
        height: tile.height,
        chunk: tile.chunk
      }));
  }

  estimateMemoryBytes() {
    const chunkMetadata = this.chunks.length * 160;
    const cacheBytes = this.cache.estimateMemoryBytes?.() || 0;
    const activeRecords = this.activeChunks.size * 64;
    return chunkMetadata + cacheBytes + activeRecords;
  }

  _unload(key, chunk) {
    if (this.mode === 'lowres') {
      chunk.lowResolution = true;
      chunk.disabled = false;
      chunk.data = null;
      return;
    }
    this.cache.release(key);
    chunk.disabled = true;
  }

  _hydrate(chunk) {
    if (chunk.data) return chunk.data;
    const source = chunk.layer.data || [];
    chunk.data = [];
    for (let localY = 0; localY < chunk.height; localY += 1) {
      for (let localX = 0; localX < chunk.width; localX += 1) {
        const tileX = chunk.x + localX;
        const tileY = chunk.y + localY;
        chunk.data.push(source[tileY * chunk.layer.width + tileX] || 0);
      }
    }
    return chunk.data;
  }

  _tileRecord(chunk, localX, localY, tileId) {
    const tileWidth = this.tilemap.tileWidth || chunk.layer.tileWidth || 16;
    const tileHeight = this.tilemap.tileHeight || chunk.layer.tileHeight || 16;
    const tileX = chunk.x + localX;
    const tileY = chunk.y + localY;
    return {
      id: `${chunk.key}:${localX}:${localY}`,
      layer: chunk.layer.name,
      tileId,
      gid: tileId,
      tileX,
      tileY,
      x: tileX * tileWidth,
      y: tileY * tileHeight,
      width: tileWidth,
      height: tileHeight,
      chunk
    };
  }

  _buildChunks() {
    const chunks = [];
    for (const layer of this.tilemap.layers.filter((item) => item.type === 'tilelayer')) {
      const tileWidth = this.tilemap.tileWidth || layer.tileWidth || 16;
      const tileHeight = this.tilemap.tileHeight || layer.tileHeight || 16;
      const chunkTilesX = Math.max(1, Math.floor(this.chunkPixelSize / tileWidth));
      const chunkTilesY = Math.max(1, Math.floor(this.chunkPixelSize / tileHeight));
      for (let y = 0; y < layer.height; y += chunkTilesY) {
        for (let x = 0; x < layer.width; x += chunkTilesX) {
          const cx = Math.floor(x / chunkTilesX);
          const cy = Math.floor(y / chunkTilesY);
          chunks.push({
            key: `${layer.name}:${cx}:${cy}`,
            layer,
            x,
            y,
            width: Math.min(chunkTilesX, layer.width - x),
            height: Math.min(chunkTilesY, layer.height - y),
            bounds: {
              x: x * tileWidth,
              y: y * tileHeight,
              width: Math.min(chunkTilesX, layer.width - x) * tileWidth,
              height: Math.min(chunkTilesY, layer.height - y) * tileHeight
            },
            data: null,
            disabled: true,
            lowResolution: false
          });
        }
      }
    }
    return chunks;
  }
}

function pad(viewport, amount) {
  return {
    x: viewport.x - amount,
    y: viewport.y - amount,
    width: viewport.width + amount * 2,
    height: viewport.height + amount * 2
  };
}

function intersects(left, right) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

export default ChunkManager;
