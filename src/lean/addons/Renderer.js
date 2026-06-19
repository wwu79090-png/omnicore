import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_MICROKERNEL_RENDERER
} from '../../config/defaults.js';
import { createOmniError } from '../../core/OmniError.js';

/**
 * Lean renderer addon with Pixi/global-PIXI routing and Canvas fallback.
 */
export class RendererAddon {
  constructor({
    backend = DEFAULT_MICROKERNEL_RENDERER,
    width = DEFAULT_CANVAS_WIDTH,
    height = DEFAULT_CANVAS_HEIGHT,
    background = DEFAULT_BACKGROUND_COLOR,
    parent = null
  } = {}) {
    this.backendPreference = backend;
    this.backend = null;
    this.width = width;
    this.height = height;
    this.background = background;
    this.parent = parent;
    this.canvas = null;
    this.ctx = null;
    this.PIXI = null;
    this.app = null;
    this.stage = null;
    this.drawCount = 0;
    this.lastRenderMs = 0;
    this.fps = 0;
  }

  async mount(bootstrap, options = {}) {
    this.width = options.width || this.width;
    this.height = options.height || this.height;
    this.parent = options.parent || this.parent;
    this.canvas = options.canvas || bootstrap.document?.createElement?.('canvas') || createNoopCanvas();
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const container = resolveParent(this.parent, bootstrap.document);
    container?.appendChild?.(this.canvas);
    await this.routeBackend(bootstrap, options);
    return this;
  }

  async routeBackend(bootstrap, options = {}) {
    const candidates = this.backendPreference === 'auto' ? ['pixi', 'canvas'] : [this.backendPreference];
    for (const candidate of candidates) {
      try {
        if (candidate === 'pixi') await this._initPixi(options);
        else this._initCanvas();
        this.backend = candidate;
        bootstrap.store.set('renderer:backend', candidate);
        return this;
      } catch (error) {
        bootstrap.store.set('renderer:lastError', error.message);
      }
    }
    this._initCanvas();
    this.backend = 'canvas';
    return this;
  }

  drawRect({ x = 0, y = 0, width = 1, height = 1, color = '#fff', alpha = 1 } = {}) {
    const start = now();
    if (this.backend === 'pixi' && this.PIXI?.Graphics && this.stage) {
      const graphic = new this.PIXI.Graphics();
      if (typeof graphic.rect === 'function') {
        graphic.rect(x, y, width, height);
        graphic.fill?.({ color: parseColor(color), alpha });
      } else {
        graphic.beginFill?.(parseColor(color), alpha);
        graphic.drawRect?.(x, y, width, height);
        graphic.endFill?.();
      }
      this.stage.addChild?.(graphic);
      this._recordRender(start);
      return graphic;
    }
    this.ctx.save?.();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect?.(x, y, width, height);
    this.ctx.restore?.();
    this._recordRender(start);
    return null;
  }

  drawText({ text = '', x = 0, y = 0, color = '#fff', font = '16px sans-serif' } = {}) {
    const start = now();
    if (this.backend === 'pixi' && this.PIXI?.Text && this.stage) {
      const displayText = new this.PIXI.Text({
        text: String(text),
        style: { fill: parseColor(color), fontFamily: font }
      });
      displayText.x = x;
      displayText.y = y;
      this.stage.addChild?.(displayText);
      this._recordRender(start);
      return displayText;
    }
    this.ctx.save?.();
    this.ctx.fillStyle = color;
    this.ctx.font = font;
    this.ctx.fillText?.(String(text), x, y);
    this.ctx.restore?.();
    this._recordRender(start);
    return null;
  }

  clear() {
    if (this.backend === 'pixi') {
      this.stage?.removeChildren?.();
      return;
    }
    this.ctx.fillStyle = this.background;
    this.ctx.fillRect?.(0, 0, this.canvas.width, this.canvas.height);
  }

  unmount() {
    this.app?.destroy?.(true, true);
    this.app = null;
    this.stage = null;
    this.PIXI = null;
    this.canvas?.remove?.();
    this.canvas = null;
    this.ctx = null;
  }

  async _initPixi(options) {
    const PIXIRef = options.PIXI || globalThis.PIXI;
    if (!PIXIRef?.Application) throw createOmniError('Renderer', 'PIXI 全局对象不可用，无法初始化 lean 渲染器。');
    if (!this.canvas.getContext?.('webgl') && !this.canvas.getContext?.('webgl2')) throw createOmniError('Renderer', 'WebGL 不可用，已降级至 Canvas 2D。');
    this.PIXI = PIXIRef;
    const appOptions = {
      width: this.width,
      height: this.height,
      background: this.background,
      backgroundColor: parseColor(this.background),
      view: this.canvas,
      canvas: this.canvas,
      autoStart: false
    };
    this.app = new PIXIRef.Application(appOptions);
    if (typeof this.app.init === 'function') await this.app.init(appOptions);
    this.stage = this.app.stage;
    this.canvas = this.app.canvas || this.app.view || this.canvas;
  }

  _initCanvas() {
    this.ctx = this.canvas.getContext?.('2d') || createNoopContext();
    this.clear();
  }

  _recordRender(start) {
    this.drawCount += 1;
    this.lastRenderMs = now() - start;
    this.fps = this.lastRenderMs > 0 ? Math.min(60, Math.round(1000 / this.lastRenderMs)) : 60;
  }
}

function resolveParent(parent, documentRef) {
  if (!documentRef) return null;
  if (!parent) return documentRef.body;
  if (typeof parent === 'string') return documentRef.querySelector(parent);
  return parent;
}

function now() {
  return globalThis.performance?.now?.() || Date.now();
}

function parseColor(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.startsWith('#')) return Number.parseInt(value.slice(1), 16);
  return 0xffffff;
}

function createNoopCanvas() {
  return { width: 0, height: 0, getContext: () => createNoopContext(), remove() {} };
}

function createNoopContext() {
  const noop = () => {};
  return {
    save: noop,
    restore: noop,
    fillRect: noop,
    fillText: noop
  };
}

export default RendererAddon;
