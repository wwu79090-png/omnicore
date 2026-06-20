import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from '../config/defaults.js';
import { expandVectorPrimitive } from '../renderer/VectorPrimitives.js';

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

  drawPrimitive(primitive = {}, options = {}) {
    if (!this.ctx) return;
    const commands = expandVectorPrimitive(primitive);
    for (const command of commands) this._drawVectorCommand(command);
    if (!options.replay) this._recordCommand({ op: 'primitive', primitive });
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
    if (command.op === 'primitive') this.drawPrimitive(command.primitive, options);
    if (['polygon', 'ring', 'capsule', 'sector', 'bezier', 'richText'].includes(command.op)) this._drawVectorCommand(command);
  }

  _drawVectorCommand(command) {
    if (!this.ctx) return;
    if (command.op === 'rect' && isSimpleFill(command)) {
      this.drawRect({
        x: command.x,
        y: command.y,
        width: command.width,
        height: command.height,
        color: command.fill,
        alpha: command.alpha
      }, { replay: true });
      return;
    }
    if (command.op === 'text') {
      this._drawTextCommand(command);
      return;
    }
    if (command.op === 'richText') {
      this._drawRichTextCommand(command);
      return;
    }
    this.ctx.save?.();
    this._applyMask(command.mask);
    this.ctx.globalAlpha = command.alpha ?? 1;
    if (command.blendMode) this.ctx.globalCompositeOperation = command.blendMode;
    const fill = this._resolveFill(command.fill);
    const stroke = this._resolveFill(command.stroke);
    if (fill) this.ctx.fillStyle = fill;
    if (stroke) this.ctx.strokeStyle = stroke;
    if (command.lineWidth != null) this.ctx.lineWidth = command.lineWidth;
    this.ctx.beginPath?.();
    this._pathVectorCommand(command);
    if (command.fill) this.ctx.fill?.(command.fillRule || undefined);
    if (command.stroke) this.ctx.stroke?.();
    this.ctx.restore?.();
  }

  _drawTextCommand(command) {
    this.ctx.save?.();
    this._applyMask(command.mask);
    this.ctx.globalAlpha = command.alpha ?? 1;
    if (command.blendMode) this.ctx.globalCompositeOperation = command.blendMode;
    this.ctx.fillStyle = this._resolveFill(command.fill) || '#ffffff';
    this.ctx.font = command.font;
    this.ctx.fillText?.(command.text, command.x, command.y);
    this.ctx.restore?.();
  }

  _drawRichTextCommand(command) {
    this.ctx.save?.();
    this._applyMask(command.mask);
    this.ctx.globalAlpha = command.alpha ?? 1;
    if (command.blendMode) this.ctx.globalCompositeOperation = command.blendMode;
    for (const line of command.layout?.lines || []) {
      for (const segment of line.segments || []) {
        this.ctx.save?.();
        this.ctx.font = segment.font;
        this.ctx.fillStyle = segment.fill;
        if (segment.stroke) this.ctx.strokeStyle = segment.stroke;
        if (segment.lineWidth != null) this.ctx.lineWidth = segment.lineWidth;
        if (segment.shadow) {
          this.ctx.shadowColor = segment.shadow.color || 'transparent';
          this.ctx.shadowBlur = Number(segment.shadow.blur || 0);
          this.ctx.shadowOffsetX = Number(segment.shadow.offsetX || 0);
          this.ctx.shadowOffsetY = Number(segment.shadow.offsetY || 0);
        }
        const x = command.x + segment.x;
        const y = command.y + line.y;
        if (segment.stroke) this.ctx.strokeText?.(segment.text, x, y);
        this.ctx.fillText?.(segment.text, x, y);
        this.ctx.restore?.();
      }
    }
    this.ctx.restore?.();
  }

  _applyMask(mask) {
    if (!mask) return;
    const commands = expandVectorPrimitive(mask);
    if (!commands.length) return;
    this.ctx.beginPath?.();
    for (const command of commands) this._pathVectorCommand(command);
    this.ctx.clip?.();
  }

  _pathVectorCommand(command) {
    if (command.op === 'rect') this._pathRect(command);
    if (command.op === 'polygon') this._pathPolygon(command);
    if (command.op === 'ring') this._pathRing(command);
    if (command.op === 'capsule') this._pathCapsule(command);
    if (command.op === 'sector') this._pathSector(command);
    if (command.op === 'bezier') this._pathBezier(command);
  }

  _pathRect(command) {
    if (this.ctx.rect) {
      this.ctx.rect(command.x, command.y, command.width, command.height);
      return;
    }
    this.ctx.moveTo?.(command.x, command.y);
    this.ctx.lineTo?.(command.x + command.width, command.y);
    this.ctx.lineTo?.(command.x + command.width, command.y + command.height);
    this.ctx.lineTo?.(command.x, command.y + command.height);
    this.ctx.closePath?.();
  }

  _pathPolygon(command) {
    const [first, ...rest] = command.points || [];
    if (!first) return;
    this.ctx.moveTo?.(first.x, first.y);
    for (const point of rest) this.ctx.lineTo?.(point.x, point.y);
    this.ctx.closePath?.();
  }

  _pathRing(command) {
    this.ctx.arc?.(command.x, command.y, command.outerRadius, 0, Math.PI * 2, false);
    this.ctx.arc?.(command.x, command.y, command.innerRadius, 0, Math.PI * 2, true);
    this.ctx.closePath?.();
  }

  _pathCapsule(command) {
    const { x, y, width, height, radius } = command;
    const right = x + width;
    const bottom = y + height;
    const r = Math.min(radius, width / 2, height / 2);
    this.ctx.moveTo?.(x + r, y);
    this.ctx.lineTo?.(right - r, y);
    this.ctx.quadraticCurveTo?.(right, y, right, y + r);
    this.ctx.lineTo?.(right, bottom - r);
    this.ctx.quadraticCurveTo?.(right, bottom, right - r, bottom);
    this.ctx.lineTo?.(x + r, bottom);
    this.ctx.quadraticCurveTo?.(x, bottom, x, bottom - r);
    this.ctx.lineTo?.(x, y + r);
    this.ctx.quadraticCurveTo?.(x, y, x + r, y);
    this.ctx.closePath?.();
  }

  _pathSector(command) {
    this.ctx.moveTo?.(command.x, command.y);
    this.ctx.arc?.(command.x, command.y, command.radius, command.startAngle, command.endAngle, command.endAngle < command.startAngle);
    this.ctx.closePath?.();
  }

  _pathBezier(command) {
    this.ctx.moveTo?.(command.start.x, command.start.y);
    this.ctx.bezierCurveTo?.(
      command.cp1.x,
      command.cp1.y,
      command.cp2.x,
      command.cp2.y,
      command.end.x,
      command.end.y
    );
  }

  _resolveFill(fill) {
    if (!fill || typeof fill !== 'object') return fill;
    if (fill.type === 'linear-gradient') {
      const gradient = this.ctx.createLinearGradient?.(fill.x0, fill.y0, fill.x1, fill.y1);
      for (const stop of fill.stops || []) gradient?.addColorStop?.(stop.offset, stop.color);
      return gradient || '#ffffff';
    }
    if (fill.type === 'radial-gradient') {
      const gradient = this.ctx.createRadialGradient?.(fill.x0, fill.y0, fill.r0, fill.x1, fill.y1, fill.r1);
      for (const stop of fill.stops || []) gradient?.addColorStop?.(stop.offset, stop.color);
      return gradient || '#ffffff';
    }
    if (fill.type === 'conic-gradient') {
      const gradient = this.ctx.createConicGradient?.(fill.startAngle || 0, fill.x || 0, fill.y || 0);
      for (const stop of fill.stops || []) gradient?.addColorStop?.(stop.offset, stop.color);
      return gradient || '#ffffff';
    }
    if (fill.type === 'texture') {
      return this.ctx.createPattern?.(fill.source, fill.repetition) || '#ffffff';
    }
    return fill.color || '#ffffff';
  }

  _recordCommand(command) {
    this.drawCommands.push(command);
    this.store?.set?.('microkernel:drawCommands', [...this.drawCommands]);
  }
}

function isSimpleFill(command) {
  return !command.mask
    && !command.blendMode
    && (!command.fill || typeof command.fill !== 'object')
    && !command.stroke;
}

export default CanvasRendererAddon;
