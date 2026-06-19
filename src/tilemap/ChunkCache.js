/**
 * Small cache for tilemap chunks.
 *
 * @example
 * const cache = new ChunkCache();
 * cache.set('Ground:0:0', chunk);
 */
export class ChunkCache {
  constructor() {
    this.items = new Map();
  }

  set(key, chunk) {
    this.items.set(key, chunk);
    return chunk;
  }

  get(key) {
    return this.items.get(key) || null;
  }

  has(key) {
    return this.items.has(key);
  }

  release(key) {
    const chunk = this.items.get(key);
    chunk?.texture?.destroy?.(true);
    if (chunk) {
      chunk.disabled = true;
      chunk.data = null;
      chunk.released = true;
    }
    this.items.delete(key);
    return chunk || null;
  }

  estimateMemoryBytes() {
    let total = 0;
    for (const chunk of this.items.values()) {
      total += 160;
      total += (chunk.data?.length || 0) * 8;
      if (chunk.texture) total += chunk.bounds.width * chunk.bounds.height * 4;
    }
    return total;
  }

  clear() {
    for (const key of [...this.items.keys()]) this.release(key);
  }
}

export default ChunkCache;
