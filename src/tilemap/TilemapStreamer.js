import { createTilemapChunkStreamPlan } from './TilemapChunkStreaming.js';

export class TilemapStreamer {
  constructor({
    chunkSize = 16,
    workerFactory = null
  } = {}) {
    this.chunkSize = chunkSize;
    this.workerFactory = workerFactory;
    this.worker = workerFactory?.() || null;
    this.scheduled = [];
  }

  prefetchAround(center = {}, { radius = 1 } = {}) {
    const chunks = [];
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        chunks.push({
          chunkX: Number(center.chunkX || 0) + x,
          chunkY: Number(center.chunkY || 0) + y,
          size: this.chunkSize
        });
      }
    }
    this.scheduled = chunks;
    this.worker?.postMessage?.({
      type: 'prefetch',
      chunks
    });
    return chunks;
  }

  planViewport(viewport = {}, options = {}) {
    return createTilemapChunkStreamPlan({
      viewport,
      chunkSize: this.chunkSize,
      loadedChunks: this.scheduled.map((chunk) => `${chunk.chunkX},${chunk.chunkY}`),
      ...options
    });
  }

  destroy() {
    this.worker?.postMessage?.({ type: 'destroy' });
    this.worker?.terminate?.();
    this.worker = null;
    this.scheduled = [];
  }
}

export default TilemapStreamer;
