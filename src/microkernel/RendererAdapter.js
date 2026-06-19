import CanvasRendererAddon from '../addons/CanvasRenderer.js';
import PixiRendererAddon from '../addons/PixiRenderer.js';
import { DEFAULT_MICROKERNEL_RENDERER } from '../config/defaults.js';
import { createOmniError, toOmniError } from '../core/OmniError.js';

/**
 * Renderer abstraction for optional microkernel mode.
 *
 * @example
 * const renderer = new RendererAdapter({ adapter: 'auto' });
 * await renderer.init({ canvas });
 */
export class RendererAdapter {
  constructor({
    adapter = DEFAULT_MICROKERNEL_RENDERER,
    adapters = {},
    candidates = ['pixi', 'canvas'],
    logger = null,
    config = {}
  } = {}) {
    this.adapter = adapter;
    this.adapters = {
      pixi: (options) => new PixiRendererAddon(options),
      canvas: (options) => new CanvasRendererAddon(options),
      ...adapters
    };
    this.candidates = candidates;
    this.logger = logger;
    this.config = config;
    this.activeBackend = null;
    this.activeBackendName = null;
    this.attempts = [];
    this.lastError = null;
    this.downgraded = false;
  }

  /**
   * @param {Record<string, *>} context Runtime renderer context.
   * @returns {Promise<object>} Active renderer backend.
   */
  async init(context = {}) {
    const names = this.adapter === 'auto' ? this.candidates : [this.adapter];
    this.attempts = [];
    this.lastError = null;

    for (const name of names) {
      try {
        this.attempts.push(name);
        const backend = await this._createBackend(name, context);
        await backend?.init?.(context);
        if (name === 'canvas' && this.lastError) this._finalizeCanvasFallback(backend, context);
        this.activeBackend = backend;
        this.activeBackendName = backend?.name || name;
        return backend;
      } catch (error) {
        this.lastError = toOmniError(error, {
          module: 'MicroKernel',
          message: `渲染后端初始化失败：${name}`
        });
        this.logger?.warn?.('microkernel', `渲染后端初始化失败，正在尝试回退：${name}`, this.lastError);
      }
    }

    throw this.lastError || createOmniError('MicroKernel', '没有可用的渲染后端。');
  }

  /**
   * @returns {void}
   */
  destroy() {
    this.activeBackend?.destroy?.();
    this.activeBackend = null;
    this.activeBackendName = null;
  }

  async _createBackend(name, context) {
    const factory = this.adapters[name];
    if (!factory) throw createOmniError('MicroKernel', `渲染后端尚未注册：${name}`);
    const result = typeof factory === 'function'
      ? factory({ ...this.config, ...context, store: context.kernel?.store || context.store, backend: name })
      : factory;
    return result && typeof result.then === 'function' ? result : Promise.resolve(result);
  }

  /**
   * @param {Record<string, *>} options Rectangle draw options.
   * @returns {*} Backend draw result.
   */
  drawRect(options) {
    return this.activeBackend?.drawRect?.(options);
  }

  /**
   * @param {Record<string, *>} options Text draw options.
   * @returns {*} Backend draw result.
   */
  drawText(options) {
    return this.activeBackend?.drawText?.(options);
  }

  _finalizeCanvasFallback(backend, context) {
    this.downgraded = true;
    backend.filtersEnabled = false;
    context.kernel?.set?.('renderer:filtersEnabled', false);
    context.store?.set?.('renderer:filtersEnabled', false);
    backend.replayFromStore?.();
  }
}

export default RendererAdapter;
