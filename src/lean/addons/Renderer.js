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

  drawPrimitive(primitive = {}) {
    const start = now();
    const commands = expandPrimitive(primitive);
    if (this.backend === 'pixi' && this.PIXI?.Graphics && this.stage) {
      const graphic = new this.PIXI.Graphics();
      commands.forEach((command) => drawPixiVectorCommand(graphic, command));
      this.stage.addChild?.(graphic);
      this._recordRender(start);
      return graphic;
    }
    commands.forEach((command) => drawCanvasVectorCommand(this.ctx, command));
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

function drawPixiVectorCommand(graphic, command) {
  if (typeof graphic.beginFill === 'function') graphic.beginFill(parseColor(command.fill), command.alpha);
  if (typeof graphic.lineStyle === 'function' && command.stroke) graphic.lineStyle(1, parseColor(command.stroke), command.alpha);
  if (command.op === 'rect') graphic.drawRect?.(command.x, command.y, command.width, command.height);
  else if (command.op === 'polygon') {
    const points = (command.points || []).flatMap((point) => [point.x, point.y]);
    graphic.drawPolygon?.(points);
  } else if (command.op === 'sector') {
    graphic.moveTo?.(command.x, command.y);
    graphic.arc?.(command.x, command.y, command.radius, command.startAngle, command.endAngle);
    graphic.closePath?.();
  } else if (command.op === 'bezier') {
    graphic.moveTo?.(command.start.x, command.start.y);
    graphic.bezierCurveTo?.(command.cp1.x, command.cp1.y, command.cp2.x, command.cp2.y, command.end.x, command.end.y);
  } else if (command.op === 'ring') {
    graphic.drawCircle?.(command.x, command.y, command.outerRadius);
    graphic.beginHole?.();
    graphic.drawCircle?.(command.x, command.y, command.innerRadius);
    graphic.endHole?.();
  } else if (command.op === 'capsule') {
    graphic.drawRoundedRect?.(command.x, command.y, command.width, command.height, command.radius);
  }
  graphic.endFill?.();
}

function expandPrimitive(primitive) {
  if (!primitive) return [];
  if (Array.isArray(primitive)) return primitive.flatMap((item) => expandPrimitive(item));
  if (Array.isArray(primitive.commands)) return primitive.commands.flatMap((item) => expandPrimitive(item));
  return primitive.op ? [primitive] : [];
}

function drawCanvasVectorCommand(ctx, command) {
  if (!ctx) return;
  if (command.op === 'rect' && isSimpleFill(command)) {
    ctx.save?.();
    ctx.globalAlpha = command.alpha;
    ctx.fillStyle = command.fill;
    ctx.fillRect?.(command.x, command.y, command.width, command.height);
    ctx.restore?.();
    return;
  }
  if (command.op === 'text') {
    ctx.save?.();
    ctx.globalAlpha = command.alpha;
    ctx.fillStyle = command.fill;
    ctx.font = command.font;
    ctx.fillText?.(command.text, command.x, command.y);
    ctx.restore?.();
    return;
  }
  if (command.op === 'richText') {
    drawCanvasRichTextCommand(ctx, command);
    return;
  }
  ctx.save?.();
  applyCanvasMask(ctx, command.mask);
  ctx.globalAlpha = command.alpha;
  if (command.blendMode) ctx.globalCompositeOperation = command.blendMode;
  const fill = resolveCanvasFill(ctx, command.fill);
  const stroke = resolveCanvasFill(ctx, command.stroke);
  if (fill) ctx.fillStyle = fill;
  if (stroke) ctx.strokeStyle = stroke;
  if (command.lineWidth != null) ctx.lineWidth = command.lineWidth;
  ctx.beginPath?.();
  pathVectorCommand(ctx, command);
  if (command.fill) ctx.fill?.(command.fillRule || undefined);
  if (command.stroke) ctx.stroke?.();
  ctx.restore?.();
}

function drawCanvasRichTextCommand(ctx, command) {
  ctx.save?.();
  applyCanvasMask(ctx, command.mask);
  ctx.globalAlpha = command.alpha;
  if (command.blendMode) ctx.globalCompositeOperation = command.blendMode;
  for (const line of command.layout?.lines || []) {
    for (const segment of line.segments || []) {
      ctx.save?.();
      ctx.font = segment.font;
      ctx.fillStyle = segment.fill;
      if (segment.stroke) ctx.strokeStyle = segment.stroke;
      if (segment.lineWidth != null) ctx.lineWidth = segment.lineWidth;
      if (segment.shadow) {
        ctx.shadowColor = segment.shadow.color || 'transparent';
        ctx.shadowBlur = Number(segment.shadow.blur || 0);
        ctx.shadowOffsetX = Number(segment.shadow.offsetX || 0);
        ctx.shadowOffsetY = Number(segment.shadow.offsetY || 0);
      }
      const x = command.x + segment.x;
      const y = command.y + line.y;
      if (segment.stroke) ctx.strokeText?.(segment.text, x, y);
      ctx.fillText?.(segment.text, x, y);
      ctx.restore?.();
    }
  }
  ctx.restore?.();
}

function applyCanvasMask(ctx, mask) {
  if (!mask) return;
  const commands = expandPrimitive(mask);
  if (!commands.length) return;
  ctx.beginPath?.();
  for (const command of commands) pathVectorCommand(ctx, command);
  ctx.clip?.();
}

function pathVectorCommand(ctx, command) {
  if (command.op === 'rect') pathRect(ctx, command);
  if (command.op === 'polygon') pathPolygon(ctx, command);
  if (command.op === 'ring') pathRing(ctx, command);
  if (command.op === 'capsule') pathCapsule(ctx, command);
  if (command.op === 'sector') pathSector(ctx, command);
  if (command.op === 'bezier') pathBezier(ctx, command);
}

function pathRect(ctx, command) {
  if (ctx.rect) {
    ctx.rect(command.x, command.y, command.width, command.height);
    return;
  }
  ctx.moveTo?.(command.x, command.y);
  ctx.lineTo?.(command.x + command.width, command.y);
  ctx.lineTo?.(command.x + command.width, command.y + command.height);
  ctx.lineTo?.(command.x, command.y + command.height);
  ctx.closePath?.();
}

function pathPolygon(ctx, command) {
  const [first, ...rest] = command.points || [];
  if (!first) return;
  ctx.moveTo?.(first.x, first.y);
  for (const point of rest) ctx.lineTo?.(point.x, point.y);
  ctx.closePath?.();
}

function pathRing(ctx, command) {
  ctx.arc?.(command.x, command.y, command.outerRadius, 0, Math.PI * 2, false);
  ctx.arc?.(command.x, command.y, command.innerRadius, 0, Math.PI * 2, true);
  ctx.closePath?.();
}

function pathCapsule(ctx, command) {
  const { x, y, width, height, radius } = command;
  const right = x + width;
  const bottom = y + height;
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo?.(x + r, y);
  ctx.lineTo?.(right - r, y);
  ctx.quadraticCurveTo?.(right, y, right, y + r);
  ctx.lineTo?.(right, bottom - r);
  ctx.quadraticCurveTo?.(right, bottom, right - r, bottom);
  ctx.lineTo?.(x + r, bottom);
  ctx.quadraticCurveTo?.(x, bottom, x, bottom - r);
  ctx.lineTo?.(x, y + r);
  ctx.quadraticCurveTo?.(x, y, x + r, y);
  ctx.closePath?.();
}

function pathSector(ctx, command) {
  ctx.moveTo?.(command.x, command.y);
  ctx.arc?.(command.x, command.y, command.radius, command.startAngle, command.endAngle, command.endAngle < command.startAngle);
  ctx.closePath?.();
}

function pathBezier(ctx, command) {
  ctx.moveTo?.(command.start.x, command.start.y);
  ctx.bezierCurveTo?.(
    command.cp1.x,
    command.cp1.y,
    command.cp2.x,
    command.cp2.y,
    command.end.x,
    command.end.y
  );
}

function resolveCanvasFill(ctx, fill) {
  if (!fill || typeof fill !== 'object') return fill;
  if (fill.type === 'linear-gradient') {
    const gradient = ctx.createLinearGradient?.(fill.x0, fill.y0, fill.x1, fill.y1);
    for (const stop of fill.stops || []) gradient?.addColorStop?.(stop.offset, stop.color);
    return gradient || '#ffffff';
  }
  if (fill.type === 'radial-gradient') {
    const gradient = ctx.createRadialGradient?.(fill.x0, fill.y0, fill.r0, fill.x1, fill.y1, fill.r1);
    for (const stop of fill.stops || []) gradient?.addColorStop?.(stop.offset, stop.color);
    return gradient || '#ffffff';
  }
  if (fill.type === 'texture') return ctx.createPattern?.(fill.source, fill.repetition) || '#ffffff';
  return fill.color || '#ffffff';
}

function isSimpleFill(command) {
  return !command.mask
    && !command.blendMode
    && (!command.fill || typeof command.fill !== 'object')
    && !command.stroke;
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
    fillText: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    rect: noop,
    clip: noop,
    closePath: noop,
    fill: noop,
    stroke: noop
  };
}

export default RendererAddon;
