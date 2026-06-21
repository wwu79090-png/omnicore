import PixiRenderer from './PixiRenderer.js';
import WebGPURenderer from './WebGPURenderer.js';
import { createRendererFallbackMatrix, resolveRendererFallbackPlan } from './RendererFallbackMatrix.js';
import { createOmniError, toOmniError } from '../core/OmniError.js';

/**
 * Multi-backend renderer manager with automatic fallback.
 *
 * @example
 * const manager = new RendererManager({ createRenderer });
 * const renderer = await manager.create('auto'); // webgpu -> webgl -> canvas
 */
export class RendererManager {
  constructor({
    createRenderer = null,
    fallbackOrder = null,
    fallbackMatrix = null,
    logger = null
  } = {}) {
    const hasCustomFactory = typeof createRenderer === 'function';
    this.createRenderer = createRenderer || ((backend, options = {}) => (
      backend === 'webgpu'
        ? new WebGPURenderer(options)
        : new PixiRenderer({ backend, ...options })
    ));
    this.fallbackOrder = fallbackOrder || (hasCustomFactory ? ['pixi', 'canvas'] : ['webgpu', 'webgl', 'canvas']);
    this.fallbackMatrix = fallbackMatrix || createRendererFallbackMatrix();
    this.fallbackPlan = resolveRendererFallbackPlan('auto', this.fallbackMatrix, this.fallbackOrder);
    this.logger = logger;
    this.attempts = [];
    this.lastError = null;
  }

  async create(preferred = 'auto', options = {}) {
    const order = preferred === 'auto' ? this.fallbackOrder : [preferred];
    this.fallbackPlan = resolveRendererFallbackPlan(preferred, this.fallbackMatrix, order);
    this.attempts = [];
    this.lastError = null;

    for (const backend of order) {
      try {
        this.attempts.push(backend);
        const renderer = await this.createRenderer(backend, options);
        if (renderer?.init && !renderer.app && !renderer.ctx) await renderer.init();
        return renderer;
      } catch (error) {
        this.lastError = toOmniError(error, {
          module: 'Renderer',
          message: `渲染后端初始化失败：${backend}`
        });
        this.logger?.warn?.('renderer', `渲染后端初始化失败，正在尝试回退：${backend}`, this.lastError);
      }
    }

    throw this.lastError || createOmniError('Renderer', `没有可用的渲染后端：${preferred}`);
  }
}

export default RendererManager;
