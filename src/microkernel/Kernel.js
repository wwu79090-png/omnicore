import { createOmniError } from '../core/OmniError.js';
import { DEFAULT_DEBUG } from '../config/defaults.js';

/**
 * Optional microkernel runtime for addon-based extensions.
 *
 * This module is isolated from the legacy `OmniCore.Game` implementation and is
 * only activated through `microkernel.enabled`.
 *
 * @example
 * const kernel = new Kernel();
 * kernel.addon('telemetry', { init() {}, destroy() {} });
 * kernel.use('telemetry');
 */
export class Kernel {
  constructor({
    context = {},
    logger = null,
    debug = DEFAULT_DEBUG,
    performanceThreshold = 100,
    requestAnimationFrame: raf = globalThis.requestAnimationFrame?.bind(globalThis),
    cancelAnimationFrame: caf = globalThis.cancelAnimationFrame?.bind(globalThis)
  } = {}) {
    this.context = context;
    this.logger = logger;
    this.debug = debug;
    this.performanceThreshold = performanceThreshold;
    this.requestAnimationFrame = raf || ((callback) => setTimeout(() => callback(Date.now()), 16));
    this.cancelAnimationFrame = caf || ((id) => clearTimeout(id));
    this.addons = new Map();
    this.active = {};
    this.state = new Map();
    this.dirty = new Map();
    this.renderers = new Set();
    this.frameHandle = null;
    this.frameDrawInstructions = 0;
    this.flushing = false;
    this.store = {
      set: (key, value) => this.set(key, value),
      get: (key) => this.get(key),
      snapshot: () => this.snapshot()
    };
  }

  /**
   * @param {string} name Addon name.
   * @param {object} instance Addon instance.
   * @returns {Kernel} This kernel.
   */
  addon(name, instance) {
    if (!name) throw createOmniError('MicroKernel', '注册 Addon 需要提供名称。');
    if (!instance) throw createOmniError('MicroKernel', `Addon 缺少实例：${name}`);
    if (this.addons.has(name)) {
      this.logger?.warn?.('microkernel', `Addon 已存在，将覆盖注册：${name}`);
    }
    this.addons.set(name, instance);
    return this;
  }

  /**
   * @param {string} name Addon name.
   * @param {Record<string, *>} options Addon init options.
   * @returns {object} Activated addon.
   */
  use(name, options = {}) {
    if (this.active[name]) return this.active[name];
    const addon = this.addons.get(name);
    if (!addon) throw createOmniError('MicroKernel', `Addon 未找到：${name}`);
    addon.init?.(this, options);
    this._negotiateAddonContract(name, addon);
    this.active[name] = addon;
    return addon;
  }

  /**
   * @param {string} name Addon name.
   * @returns {boolean} Whether the addon is registered.
   */
  has(name) {
    return this.addons.has(name);
  }

  /**
   * @param {string} key State key.
   * @param {*} value State value.
   * @returns {*} Stored value.
   */
  set(key, value) {
    this.state.set(key, value);
    this.markDirty(key, value);
    return value;
  }

  /**
   * @param {string} key State key.
   * @returns {*} Stored value.
   */
  get(key) {
    return this.state.get(key);
  }

  /**
   * @returns {Record<string, *>} Plain state snapshot.
   */
  snapshot() {
    return Object.fromEntries(this.state);
  }

  /**
   * @param {string} id Entity id.
   * @param {Record<string, *>} patch Entity patch.
   * @returns {Record<string, *>} Updated entity state.
   */
  updateEntity(id, patch = {}) {
    const key = `entity:${id}`;
    const next = { ...(this.state.get(key) || {}), ...patch };
    this.set(key, next);
    return next;
  }

  /**
   * @param {string} key Dirty state key.
   * @param {*} value Dirty value.
   * @returns {void}
   */
  markDirty(key, value = this.state.get(key)) {
    this.dirty.set(key, value);
    this._scheduleFlush();
  }

  /**
   * @param {object} renderer Renderer-like object.
   * @returns {Kernel} This kernel.
   */
  attachRenderer(renderer) {
    if (!renderer) return this;
    this.renderers.add(renderer);
    return this;
  }

  /**
   * @param {object} renderer Renderer-like object.
   * @returns {Kernel} This kernel.
   */
  detachRenderer(renderer) {
    this.renderers.delete(renderer);
    return this;
  }

  /**
   * @param {number} count Draw instruction count to add.
   * @returns {void}
   */
  recordDrawInstruction(count = 1) {
    this.frameDrawInstructions += count;
  }

  /**
   * @returns {Promise<void>} Resolves after active addons are destroyed.
   */
  async destroy() {
    if (this.frameHandle != null) {
      this.cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
    const activeAddons = Object.values(this.active).reverse();
    for (const addon of activeAddons) {
      await addon.destroy?.();
    }
    this.active = {};
    this.addons.clear();
    this.state.clear();
    this.dirty.clear();
    this.renderers.clear();
  }

  _scheduleFlush() {
    if (this.frameHandle != null) return;
    this.frameHandle = this.requestAnimationFrame((time) => this._flushDirty(time));
  }

  _flushDirty(time) {
    this.frameHandle = null;
    if (!this.dirty.size || this.flushing) return;
    this.flushing = true;
    this.frameDrawInstructions = 0;
    const dirty = [...this.dirty.entries()].map(([key, value]) => ({ key, value }));
    this.dirty.clear();
    const payload = { dirty, snapshot: this.snapshot(), kernel: this, time };

    for (const renderer of this.renderers) {
      renderer.renderDirty?.(payload);
    }

    if (this.debug && this.frameDrawInstructions > this.performanceThreshold) {
      this.logger?.warn?.(
        'microkernel',
        `单帧绘制指令过多：${this.frameDrawInstructions}`
      );
    }
    this.flushing = false;
  }

  _negotiateAddonContract(addonName, addon) {
    const contract = addon?.contract || addon?.resourceContract;
    if (!contract) return null;
    const responses = [];
    for (const renderer of this.renderers) {
      const response = renderer.negotiateAddonContract?.(contract, {
        addonName,
        addon,
        kernel: this
      });
      if (response) responses.push(response);
    }
    const busy = responses.find((response) => response.status === 'busy');
    const negotiated = {
      status: busy ? 'busy' : 'ok',
      responses
    };
    if (busy?.samplingRateScale && contract.requestAnimationFrame?.samplingRate) {
      addon.samplingRate = Math.max(1, Math.round(contract.requestAnimationFrame.samplingRate * busy.samplingRateScale));
    } else if (contract.requestAnimationFrame?.samplingRate && addon.samplingRate == null) {
      addon.samplingRate = contract.requestAnimationFrame.samplingRate;
    }
    Object.defineProperty(addon, '__omnicoreContract', {
      configurable: true,
      enumerable: false,
      value: negotiated
    });
    addon.onContractUpdate?.(negotiated);
    return negotiated;
  }
}

export default Kernel;
