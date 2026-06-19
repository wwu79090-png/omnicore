import EventBus from './EventBus.js';
import Store from './Store.js';
import { DEFAULT_DEBUG, DEFAULT_ENGINE_VERSION } from '../../config/defaults.js';
import { toOmniError } from '../../core/OmniError.js';

/**
 * Lean bootstrapper: platform detection, splash screen, crash capture, and
 * addon orchestration.
 *
 * @example
 * const bootstrap = new Bootstrap({ addons: { renderer } });
 * await bootstrap.start();
 */
export class Bootstrap {
  constructor({
    addons = {},
    store = null,
    bus = null,
    documentRef = globalThis.document,
    windowRef = globalThis.window || globalThis,
    debug = DEFAULT_DEBUG,
    version = DEFAULT_ENGINE_VERSION
  } = {}) {
    this.addonFactories = addons;
    this.document = documentRef;
    this.window = windowRef;
    this.bus = bus || new EventBus();
    this.store = store || new Store({ version, debug });
    this.debug = debug;
    this.version = version;
    this.platform = detectPlatform(windowRef);
    this.addons = {};
    this.splash = null;
    this.crashHandler = (event) => this.recover(event?.error || event?.reason || event);
  }

  async start(config = {}) {
    this.store.set('omnicore:platform', config.platform || this.platform);
    this.showSplash(config.splashText || 'OmniCore booting...');
    this._bindCrashCapture();
    try {
      for (const [name, factory] of Object.entries(this.addonFactories)) {
        const addon = typeof factory === 'function' ? factory(config[name] || {}, this) : factory;
        this.addons[name] = addon;
        await addon?.mount?.(this, config[name] || {});
      }
      this.hideSplash();
      this.bus.emit('ready', this);
      return this;
    } catch (error) {
      const omniError = toOmniError(error, { module: 'Bootstrap', message: 'lean runtime 启动失败。' });
      this.recover(omniError);
      throw omniError;
    }
  }

  showSplash(text) {
    if (!this.document?.createElement || this.splash) return null;
    const element = this.document.createElement('div');
    element.dataset.omnicoreSplash = 'true';
    element.textContent = text;
    Object.assign(element.style, {
      position: 'fixed',
      inset: '0',
      display: 'grid',
      placeItems: 'center',
      background: '#020617',
      color: '#e2e8f0',
      zIndex: '2147483647',
      font: '14px system-ui, sans-serif'
    });
    this.document.body?.appendChild?.(element);
    this.splash = element;
    return element;
  }

  hideSplash() {
    this.splash?.remove?.();
    this.splash = null;
  }

  recover(error) {
    const payload = {
      message: error?.message || String(error),
      stack: error?.stack || '',
      at: new Date().toISOString()
    };
    this.store.set('omnicore:lastCrash', payload);
    this.bus.emit('crash', payload);
    this.hideSplash();
    return payload;
  }

  async destroy() {
    for (const addon of Object.values(this.addons).reverse()) await addon?.unmount?.(this);
    this.addons = {};
    this._unbindCrashCapture();
    this.hideSplash();
    this.bus.clear();
  }

  _bindCrashCapture() {
    this.window?.addEventListener?.('error', this.crashHandler);
    this.window?.addEventListener?.('unhandledrejection', this.crashHandler);
  }

  _unbindCrashCapture() {
    this.window?.removeEventListener?.('error', this.crashHandler);
    this.window?.removeEventListener?.('unhandledrejection', this.crashHandler);
  }
}

export function detectPlatform(env = globalThis) {
  const userAgent = env.navigator?.userAgent || '';
  if (env.wx || /MicroMessenger|MiniGame/i.test(userAgent)) return 'wechat';
  if (env.tt || /Douyin|ToutiaoMicroApp|ByteDance/i.test(userAgent)) return 'douyin';
  if (env.process?.versions?.electron || /Electron/i.test(userAgent)) return 'electron';
  return 'web';
}

export default Bootstrap;
