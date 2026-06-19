import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from '../config/defaults.js';

/**
 * Canvas renderer addon used by optional microkernel RendererAdapter.
 *
 * @example
 * const renderer = new CanvasRendererAddon({ width: 800, height: 600 });
 * renderer.init({ canvas });
 */
export class CanvasRendererAddon {
  constructor({ canvas = null, width = DEFAULT_CANVAS_WIDTH, height = DEFAULT_CANVAS_HEIGHT, background = '#000', store = null } = {}) {
    this.name = 'canvas';
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.background = background;
    this.store = store;
    this.filtersEnabled = false;
    this.ctx = null;
    this.drawCommands = [];
  }

  init(context = {}) {
    this.canvas = this.canvas || context.canvas || context.game?.core?.canvas || document.createElement('canvas');
    this.store = this.store || context.kernel?.store || context.store || null;
    this.canvas.width = this.canvas.width || this.width;
    this.canvas.height = this.canvas.height || this.height;
    this.ctx = this.canvas.getContext?.('2d') || null;
    this.clear();
    this.replayFromStore();
    return this;
  }

  clear() {
    if (!this.ctx) return;
    this.ctx.fillStyle = this.background;
    this.ctx.fillRect?.(0, 0, this.canvas.width, this.canvas.height);
  }

  drawRect({ x = 0, y = 0, width = 1, height = 1, color = '#fff', alpha = 1 } = {}, options = {}) {
    if (!this.ctx) return;
    this.ctx.save?.();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect?.(x, y, width, height);
    this.ctx.restore?.();
    if (!options.replay) this._recordCommand({ op: 'rect', x, y, width, height, color, alpha });
  }

  drawText({ text = '', x = 0, y = 0, color = '#fff', font = '16px sans-serif' } = {}, options = {}) {
    if (!this.ctx) return;
    this.ctx.save?.();
    this.ctx.fillStyle = color;
    this.ctx.font = font;
    this.ctx.fillText?.(String(text), x, y);
    this.ctx.restore?.();
    if (!options.replay) this._recordCommand({ op: 'text', text, x, y, color, font });
  }

  applyFilter() {
    return false;
  }

  renderDirty({ dirty = [] } = {}) {
    dirty.forEach(({ value }) => {
      if (value?.draw) this._drawCommand(value.draw);
    });
  }

  replayFromStore() {
    const commands = this.store?.get?.('microkernel:drawCommands') || [];
    commands.forEach((command) => this._drawCommand(command, { replay: true }));
  }

  destroy() {
    this.ctx = null;
  }

  _drawCommand(command, options = {}) {
    if (command.op === 'rect') this.drawRect(command, options);
    if (command.op === 'text') this.drawText(command, options);
  }

  _recordCommand(command) {
    this.drawCommands.push(command);
    this.store?.set?.('microkernel:drawCommands', [...this.drawCommands]);
  }
}

export default CanvasRendererAddon;
