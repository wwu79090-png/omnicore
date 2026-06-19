/**
 * Thin OffscreenCanvas worker bridge for renderer backends.
 *
 * The main thread still builds draw instructions, while the bridge owns the
 * message boundary for texture upload and GPU command submission workers.
 */
export class RenderWorkerBridge {
  constructor({
    workerFactory = null,
    canvas = null,
    width = 0,
    height = 0,
    backend = 'webgpu'
  } = {}) {
    this.workerFactory = workerFactory;
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.backend = backend;
    this.worker = null;
    this.offscreen = null;
  }

  init() {
    if (!this.workerFactory) return this;
    this.worker = this.workerFactory();
    const transfers = [];
    if (this.canvas?.transferControlToOffscreen) {
      this.offscreen = this.canvas.transferControlToOffscreen();
      transfers.push(this.offscreen);
    }
    this.worker?.postMessage?.({
      type: 'init',
      backend: this.backend,
      canvas: this.offscreen,
      ownsCanvas: Boolean(this.offscreen),
      width: this.width,
      height: this.height
    }, transfers);
    return this;
  }

  frame(instructions = [], metadata = {}) {
    this.worker?.postMessage?.({
      type: 'frame',
      backend: this.backend,
      instructions,
      commandSource: metadata.commandSource || 'main',
      pipelineOwner: metadata.pipelineOwner || (metadata.commandSource === 'worker' ? 'worker' : 'main'),
      batchCount: metadata.batchCount ?? instructions.length,
      buffer: metadata.buffer || null,
      entityCount: metadata.entityCount ?? instructions.length
    });
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.worker?.postMessage?.({
      type: 'resize',
      width,
      height
    });
  }

  destroy() {
    this.worker?.postMessage?.({ type: 'destroy' });
    this.worker?.terminate?.();
    this.worker = null;
    this.offscreen = null;
  }
}

export default RenderWorkerBridge;
