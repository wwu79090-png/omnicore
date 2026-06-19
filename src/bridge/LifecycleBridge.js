import SplashScreen from '../microkernel/SplashScreen.js';

/**
 * Owns optional microkernel splash lifecycle.
 */
export class LifecycleBridge {
  constructor({ config = {}, target = null } = {}) {
    this.config = config;
    this.target = target;
    this.splash = null;
  }

  init() {
    if (this.config === false) return null;
    this.splash = new SplashScreen({ ...(this.config || {}), target: this.config?.target || this.target });
    return this.splash.show();
  }

  async hideSplash() {
    await this.splash?.hide?.();
  }

  destroy() {
    this.splash?.destroy?.();
    this.splash = null;
  }
}

export default LifecycleBridge;
