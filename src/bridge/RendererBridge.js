import RendererAdapter from '../microkernel/RendererAdapter.js';

/**
 * Owns microkernel renderer adapter initialization and teardown.
 */
export class RendererBridge {
  constructor({ game, kernel, config = {}, logger = null } = {}) {
    this.game = game;
    this.kernel = kernel;
    this.config = config;
    this.logger = logger || game?.logger || null;
    this.renderer = null;
    this.backend = null;
  }

  async init() {
    if (this.config === false) return null;
    const rendererConfig = this.config || {};
    this.renderer = new RendererAdapter({
      ...rendererConfig,
      logger: this.logger,
      config: {
        width: this.game?.config?.width,
        height: this.game?.config?.height,
        background: this.game?.config?.background,
        canvas: this.game?.core?.canvas,
        game: this.game,
        ...(rendererConfig.config || {})
      }
    });
    this.backend = await this.renderer.init({
      game: this.game,
      canvas: this.game?.core?.canvas,
      kernel: this.kernel
    });
    this.kernel?.addon?.('renderer', this.backend || this.renderer);
    this.kernel.active.renderer = this.backend || this.renderer;
    if (this.backend) this.kernel?.attachRenderer?.(this.backend);
    return this.backend;
  }

  destroy() {
    if (this.backend) this.kernel?.detachRenderer?.(this.backend);
    this.renderer?.destroy?.();
    this.renderer = null;
    this.backend = null;
  }
}

export default RendererBridge;
