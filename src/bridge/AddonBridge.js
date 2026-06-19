import AudioAddon from '../addons/Audio.js';

/**
 * Owns addon registration and activation for microkernel mode.
 */
export class AddonBridge {
  constructor({ kernel, config = {}, logger = null } = {}) {
    this.kernel = kernel;
    this.config = config;
    this.logger = logger;
  }

  register() {
    this.kernel.addon('kernel', { init: () => this.kernel });
    this.kernel.addon('audio', new AudioAddon(this.config.audio || {}));
    for (const [name, addon] of Object.entries(this.config.addons || {})) {
      this.kernel.addon(name, addon);
    }
  }

  activate() {
    const names = this.config.use || [];
    names.forEach((name) => this.kernel.use(name));
  }

  async destroy() {
    await this.kernel.destroy();
  }
}

export default AddonBridge;
