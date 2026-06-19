import Kernel from '../microkernel/Kernel.js';
import AddonBridge from './AddonBridge.js';
import LifecycleBridge from './LifecycleBridge.js';
import RendererBridge from './RendererBridge.js';

/**
 * Scheduler bridge between legacy OmniCore.Game and optional microkernel mode.
 *
 * Concrete logic lives in LifecycleBridge, RendererBridge, and AddonBridge.
 */
export class OmniCoreBridge {
  constructor({ game, config = {}, logger = null } = {}) {
    this.game = game;
    this.config = config;
    this.logger = logger || game?.logger || null;
    this.kernel = new Kernel({
      context: { game },
      logger: this.logger,
      debug: config.debug ?? game?.config?.debug ?? false,
      performanceThreshold: config.performanceThreshold ?? 100
    });
    this.lifecycle = new LifecycleBridge({ config: config.splash, target: config.splashTarget });
    this.addonBridge = new AddonBridge({ kernel: this.kernel, config, logger: this.logger });
    this.rendererBridge = new RendererBridge({ game, kernel: this.kernel, config: config.renderer, logger: this.logger });
    this.renderer = null;
    this.initialized = false;
  }

  async init() {
    if (!this.config?.enabled || this.initialized) return this;
    this.lifecycle.init();
    this.addonBridge.register();
    await this.rendererBridge.init();
    this.renderer = this.rendererBridge.renderer;
    this.addonBridge.activate();
    if (this.config.splash?.autoHide !== false) await this.hideSplash();
    this.initialized = true;
    this.game?.events?.emit?.('microkernel:init', { bridge: this });
    return this;
  }

  async hideSplash() {
    await this.lifecycle.hideSplash();
  }

  async destroy() {
    this.rendererBridge.destroy();
    this.lifecycle.destroy();
    await this.addonBridge.destroy();
    this.renderer = null;
    this.initialized = false;
    this.game?.events?.emit?.('microkernel:destroy', { bridge: this });
  }
}

export default OmniCoreBridge;
