import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from '../config/defaults.js';
import { createOmniError } from '../core/OmniError.js';

/**
 * Pixi renderer addon used by optional microkernel RendererAdapter.
 *
 * It intentionally depends on a host-provided global `PIXI` to avoid adding
 * weight to projects that do not enable microkernel rendering.
 */
export class PixiRendererAddon {
  constructor({ canvas = null, width = DEFAULT_CANVAS_WIDTH, height = DEFAULT_CANVAS_HEIGHT, background = '#000000', store = null, requireGPU = false } = {}) {
    this.name = 'pixi';
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.background = background;
    this.store = store;
    this.requireGPU = requireGPU;
    this.filtersEnabled = true;
    this.PIXI = null;
    this.app = null;
    this.drawCommands = [];
  }

  async init(context = {}) {
    const PIXIRef = context.PIXI || globalThis.PIXI;
    this.PIXI = PIXIRef;
    if (!PIXIRef?.Application) throw createOmniError('Renderer', 'PIXI 全局对象不可用，无法初始化 Pixi 渲染器。');
    if (this.requireGPU && !globalThis.navigator?.gpu) throw createOmniError('Renderer', 'GPU 不可用，无法启用当前渲染配置。');
    if (!this._hasWebGL(context.canvas)) throw createOmniError('Renderer', 'WebGL 不可用，已阻止 Pixi 渲染器初始化。');
    this.store = this.store || context.kernel?.store || context.store || null;

    this.app = new PIXIRef.Application({
      width: this.width,
      height: this.height,
      backgroundColor: parseColor(this.background),
      view: this.canvas || context.canvas
    });
    this.canvas = this.app.view || this.app.canvas;
    return this;
  }

  drawRect({ x = 0, y = 0, width = 1, height = 1, color = '#fff', alpha = 1 } = {}, options = {}) {
    if (!this.PIXI?.Graphics || !this.app?.stage) return null;
    const graphic = new this.PIXI.Graphics();
    const numericColor = parseColor(color);
    graphic.rect?.(x, y, width, height);
    graphic.fill?.({ color: numericColor, alpha });
    this.app.stage.addChild?.(graphic);
    if (!options.replay) this._recordCommand({ op: 'rect', x, y, width, height, color, alpha });
    return graphic;
  }

  drawText({ text = '', x = 0, y = 0, color = '#fff', font = '16px sans-serif' } = {}, options = {}) {
    if (!this.PIXI?.Text || !this.app?.stage) return null;
    const displayText = new this.PIXI.Text({
      text: String(text),
      style: { fill: parseColor(color), font }
    });
    displayText.x = x;
    displayText.y = y;
    this.app.stage.addChild?.(displayText);
    if (!options.replay) this._recordCommand({ op: 'text', text, x, y, color, font });
    return displayText;
  }

  applyFilter(target, filter) {
    if (!this.filtersEnabled || !target || !filter) return false;
    target.filters = [...(target.filters || []), filter];
    return true;
  }

  destroy() {
    this.app?.destroy?.(true, true);
    this.app = null;
  }

  _hasWebGL(canvas) {
    try {
      const probe = canvas || document.createElement('canvas');
      return Boolean(probe.getContext?.('webgl') || probe.getContext?.('webgl2'));
    } catch {
      return false;
    }
  }

  _recordCommand(command) {
    this.drawCommands.push(command);
    this.store?.set?.('microkernel:drawCommands', [...this.drawCommands]);
  }
}

function parseColor(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.startsWith('#')) return Number.parseInt(value.slice(1), 16);
  return 0;
}

export default PixiRendererAddon;
