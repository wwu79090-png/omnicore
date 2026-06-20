import Geom from './Geom.js';
import Transform2D from './Transform2D.js';

const BLEND_MODES = {
  normal: 'source-over',
  multiply: 'multiply',
  overlay: 'overlay',
  add: 'lighter',
  screen: 'screen'
};

function number(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeColorStop(stop) {
  if (Array.isArray(stop)) return { offset: number(stop[0]), color: String(stop[1]) };
  return { offset: number(stop?.offset), color: String(stop?.color ?? '#ffffff') };
}

function normalizePoint(point = {}) {
  return { x: number(point.x), y: number(point.y) };
}

function commandBounds(commands) {
  const points = [];
  for (const command of commands) {
    if (command.op === 'rect' || command.op === 'clip') {
      points.push({ x: command.x, y: command.y }, { x: command.x + command.width, y: command.y + command.height });
    }
    if (command.op === 'ellipse') {
      points.push({ x: command.x - command.radiusX, y: command.y - command.radiusY });
      points.push({ x: command.x + command.radiusX, y: command.y + command.radiusY });
    }
    if (command.op === 'arc') {
      points.push({ x: command.x - command.radius, y: command.y - command.radius });
      points.push({ x: command.x + command.radius, y: command.y + command.radius });
    }
    if (command.op === 'moveTo' || command.op === 'lineTo') points.push({ x: command.x, y: command.y });
    if (command.op === 'quadraticCurveTo') points.push({ x: command.cpx, y: command.cpy }, { x: command.x, y: command.y });
    if (command.op === 'bezierCurveTo') {
      points.push({ x: command.cp1x, y: command.cp1y }, { x: command.cp2x, y: command.cp2y }, { x: command.x, y: command.y });
    }
    if (command.op === 'polygon') points.push(...command.points);
  }
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

function rectContains(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

export class Graphics {
  constructor(options = {}) {
    this.type = 'graphics';
    this.commands = [];
    this.visible = options.visible ?? true;
    this.alpha = options.alpha ?? 1;
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.zIndex = options.zIndex ?? 0;
    this.transform = Transform2D.create(this, options.transform || {});
    this.children = [];
    this.currentFill = options.fill ?? '#ffffff';
    this.currentFillAlpha = options.fillAlpha ?? 1;
    this.currentStroke = options.stroke ?? null;
    this.currentStrokeAlpha = options.strokeAlpha ?? 1;
    this.currentLineWidth = options.lineWidth ?? 1;
    this.currentLineCap = options.cap ?? 'butt';
    this.currentLineJoin = options.join ?? 'miter';
    this.currentBlendMode = options.blendMode ?? 'normal';
    this.blendMode = (mode = 'normal') => {
      this.currentBlendMode = mode;
      this.commands.push({ op: 'blendMode', mode });
      return this;
    };
  }

  add(child) {
    child.parent = this;
    this.children.push(child);
    this.children.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    return child;
  }

  remove(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    if (child?.parent === this) child.parent = null;
    return child;
  }

  static gradient(type = 'linear', bounds = {}, colorStops = []) {
    return {
      kind: 'gradient',
      type,
      bounds: { ...bounds },
      colorStops: (Array.isArray(colorStops) ? colorStops : []).map(normalizeColorStop)
    };
  }

  gradient(type, bounds, colorStops) {
    return this.setFill(Graphics.gradient(type, bounds, colorStops));
  }

  lineStyle(width = 1, color = '#ffffff', alpha = 1, { cap = 'butt', join = 'miter' } = {}) {
    this.currentLineWidth = Math.max(0, number(width, 1));
    this.currentStroke = color;
    this.currentStrokeAlpha = number(alpha, 1);
    this.currentLineCap = cap;
    this.currentLineJoin = join;
    this.commands.push({
      op: 'lineStyle',
      width: this.currentLineWidth,
      color,
      alpha: this.currentStrokeAlpha,
      cap,
      join
    });
    return this;
  }

  fillStyle(color = '#ffffff', alpha = 1) {
    this.currentFill = color;
    this.currentFillAlpha = number(alpha, 1);
    this.commands.push({ op: 'fillStyle', fill: color, alpha: this.currentFillAlpha });
    return this;
  }

  setFill(fill, alpha = 1) {
    this.currentFill = fill;
    this.currentFillAlpha = number(alpha, 1);
    this.commands.push({ op: 'fillStyle', fill, alpha: this.currentFillAlpha });
    return this;
  }

  textureFill(sprite, { repetition = 'repeat' } = {}) {
    return this.setFill({ kind: 'pattern', sprite, repetition });
  }

  moveTo(x, y) {
    this.commands.push({ op: 'moveTo', x: number(x), y: number(y) });
    return this;
  }

  lineTo(x, y) {
    this.commands.push({ op: 'lineTo', x: number(x), y: number(y) });
    return this;
  }

  quadraticCurveTo(cpx, cpy, x, y) {
    this.commands.push({ op: 'quadraticCurveTo', cpx: number(cpx), cpy: number(cpy), x: number(x), y: number(y) });
    return this;
  }

  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
    this.commands.push({
      op: 'bezierCurveTo',
      cp1x: number(cp1x),
      cp1y: number(cp1y),
      cp2x: number(cp2x),
      cp2y: number(cp2y),
      x: number(x),
      y: number(y)
    });
    return this;
  }

  arc(x, y, radius, startAngle = 0, endAngle = Math.PI * 2, anticlockwise = false) {
    this.commands.push({
      op: 'arc',
      x: number(x),
      y: number(y),
      radius: Math.max(0, number(radius, 1)),
      startAngle: number(startAngle),
      endAngle: number(endAngle, Math.PI * 2),
      anticlockwise: Boolean(anticlockwise)
    });
    return this;
  }

  ellipse(x, y, radiusX, radiusY, rotation = 0, startAngle = 0, endAngle = Math.PI * 2, anticlockwise = false) {
    this.commands.push({
      op: 'ellipse',
      x: number(x),
      y: number(y),
      radiusX: Math.max(0, number(radiusX, 1)),
      radiusY: Math.max(0, number(radiusY, 1)),
      rotation: number(rotation),
      startAngle: number(startAngle),
      endAngle: number(endAngle, Math.PI * 2),
      anticlockwise: Boolean(anticlockwise)
    });
    return this;
  }

  rect(x, y, width, height) {
    this.commands.push({ op: 'rect', x: number(x), y: number(y), width: number(width), height: number(height) });
    return this;
  }

  polygon(points = []) {
    this.commands.push({ op: 'polygon', points: (Array.isArray(points) ? points : []).map(normalizePoint) });
    return this;
  }

  closePath() {
    this.commands.push({ op: 'closePath' });
    return this;
  }

  beginMask() {
    this.commands.push({ op: 'beginMask' });
    return this;
  }

  endMask() {
    this.commands.push({ op: 'endMask' });
    return this;
  }

  clip(rect) {
    this.commands.push({
      op: 'clip',
      x: number(rect?.x),
      y: number(rect?.y),
      width: number(rect?.width),
      height: number(rect?.height)
    });
    return this;
  }

  bounds() {
    return commandBounds(this.commands.filter((command) => !['beginMask', 'endMask', 'clip'].includes(command.op)));
  }

  containsPoint(x, y) {
    const px = number(x);
    const py = number(y);
    for (const command of this.commands) {
      if (command.op === 'rect' && rectContains(command, px, py)) return true;
      if (command.op === 'ellipse' && Geom.ellipse(command.x, command.y, command.radiusX * 2, command.radiusY * 2).containsPoint(px, py)) return true;
      if (command.op === 'arc' && Geom.arc(command.x, command.y, command.radius).containsPoint(px, py)) return true;
      if (command.op === 'polygon' && Geom.polygon(command.points).containsPoint(px, py)) return true;
    }
    return rectContains(this.bounds(), px, py);
  }

  intersects(target) {
    const bounds = this.bounds();
    const other = target?.bounds?.() || target;
    if (!other) return false;
    return bounds.x <= other.x + other.width
      && bounds.x + bounds.width >= other.x
      && bounds.y <= other.y + other.height
      && bounds.y + bounds.height >= other.y;
  }

  render(ctx) {
    if (!this.visible || !ctx) return;
    const state = this._initialRenderState(ctx);
    ctx.save?.();
    ctx.globalAlpha = this.alpha;
    Transform2D.applyToContext(ctx, this);
    this._applyBlend(ctx, state.blendMode);
    this._renderCommands(ctx, state);
    while (state.restoreCount > 0) {
      ctx.restore?.();
      state.restoreCount -= 1;
    }
    for (const child of this.children) child.render?.(ctx);
    ctx.restore?.();
  }

  toPixiObject({ Graphics: PixiGraphics } = {}) {
    if (typeof PixiGraphics !== 'function') return null;
    const displayObject = new PixiGraphics();
    this.syncPixiObject(displayObject);
    return displayObject;
  }

  syncPixiObject(displayObject) {
    if (!displayObject) return displayObject;
    displayObject.clear?.();
    displayObject.x = this.x;
    displayObject.y = this.y;
    displayObject.alpha = this.alpha;
    displayObject.rotation = this.rotation || 0;
    if (displayObject.scale?.set) {
      displayObject.scale.set(this.scaleX ?? 1, this.scaleY ?? 1);
    }
    const state = {
      fill: this.currentFill,
      fillAlpha: this.currentFillAlpha,
      stroke: this.currentStroke,
      strokeAlpha: this.currentStrokeAlpha,
      lineWidth: this.currentLineWidth
    };
    for (const command of this.commands) this._syncPixiCommand(displayObject, command, state);
    this._paintPixi(displayObject, state);
    return displayObject;
  }

  _initialRenderState(ctx) {
    return {
      ctx,
      fill: this.currentFill,
      fillAlpha: this.currentFillAlpha,
      stroke: this.currentStroke,
      strokeAlpha: this.currentStrokeAlpha,
      lineWidth: this.currentLineWidth,
      cap: this.currentLineCap,
      join: this.currentLineJoin,
      blendMode: this.currentBlendMode,
      pathOpen: false,
      restoreCount: 0
    };
  }

  _syncPixiCommand(displayObject, command, state) {
    if (command.op === 'fillStyle') {
      state.fill = command.fill;
      state.fillAlpha = command.alpha;
      return;
    }
    if (command.op === 'lineStyle') {
      state.stroke = command.color;
      state.strokeAlpha = command.alpha;
      state.lineWidth = command.width;
      return;
    }
    if (command.op === 'moveTo') {
      displayObject.moveTo?.(command.x, command.y);
    }
    if (command.op === 'lineTo') {
      displayObject.lineTo?.(command.x, command.y);
    }
    if (command.op === 'quadraticCurveTo') {
      displayObject.quadraticCurveTo?.(command.cpx, command.cpy, command.x, command.y);
    }
    if (command.op === 'bezierCurveTo') {
      displayObject.bezierCurveTo?.(
        command.cp1x,
        command.cp1y,
        command.cp2x,
        command.cp2y,
        command.x,
        command.y
      );
    }
    if (command.op === 'arc') {
      displayObject.arc?.(command.x, command.y, command.radius, command.startAngle, command.endAngle, command.anticlockwise);
    }
    if (command.op === 'rect') {
      displayObject.rect?.(command.x, command.y, command.width, command.height);
    }
    if (command.op === 'ellipse') {
      displayObject.ellipse?.(command.x, command.y, command.radiusX, command.radiusY);
    }
    if (command.op === 'polygon') {
      const [first, ...rest] = command.points;
      if (first) {
        displayObject.moveTo?.(first.x, first.y);
        for (const point of rest) {
          displayObject.lineTo?.(point.x, point.y);
        }
        displayObject.closePath?.();
      }
    }
    if (command.op === 'closePath') {
      displayObject.closePath?.();
    }
  }

  _paintPixi(displayObject, state) {
    const fill = typeof state.fill === 'string' ? state.fill : '#ffffff';
    if (state.fill) {
      displayObject.fill?.({ color: fill, alpha: state.fillAlpha });
      displayObject.beginFill?.(fill, state.fillAlpha);
      displayObject.endFill?.();
    }
    if (state.stroke) {
      displayObject.stroke?.({ color: state.stroke, alpha: state.strokeAlpha, width: state.lineWidth });
      displayObject.lineStyle?.(state.lineWidth, state.stroke, state.strokeAlpha);
    }
  }

  _renderCommands(ctx, state) {
    for (let index = 0; index < this.commands.length; index += 1) {
      const command = this.commands[index];
      if (command.op === 'beginMask') {
        const endIndex = this._renderMask(ctx, index + 1, state);
        index = endIndex;
        continue;
      }
      this._renderCommand(ctx, command, state);
    }
    this._flushPath(ctx, state);
  }

  _renderMask(ctx, startIndex, state) {
    ctx.save?.();
    state.restoreCount += 1;
    ctx.beginPath?.();
    let index = startIndex;
    for (; index < this.commands.length; index += 1) {
      const command = this.commands[index];
      if (command.op === 'endMask') break;
      this._pathCommand(ctx, command);
    }
    ctx.clip?.();
    return index;
  }

  _renderCommand(ctx, command, state) {
    if (command.op === 'fillStyle') {
      this._flushPath(ctx, state);
      state.fill = command.fill;
      state.fillAlpha = command.alpha;
      return;
    }
    if (command.op === 'lineStyle') {
      this._flushPath(ctx, state);
      state.stroke = command.color;
      state.strokeAlpha = command.alpha;
      state.lineWidth = command.width;
      state.cap = command.cap;
      state.join = command.join;
      return;
    }
    if (command.op === 'blendMode') {
      this._flushPath(ctx, state);
      state.blendMode = command.mode;
      this._applyBlend(ctx, state.blendMode);
      return;
    }
    if (command.op === 'clip') {
      this._flushPath(ctx, state);
      ctx.save?.();
      state.restoreCount += 1;
      ctx.beginPath?.();
      ctx.rect?.(command.x, command.y, command.width, command.height);
      ctx.clip?.();
      return;
    }
    if (command.op === 'rect' || command.op === 'ellipse' || command.op === 'polygon') {
      this._flushPath(ctx, state);
      ctx.beginPath?.();
      this._pathCommand(ctx, command);
      this._paintPath(ctx, state);
      return;
    }
    if (this._isPathCommand(command)) {
      if (!state.pathOpen) {
        ctx.beginPath?.();
        state.pathOpen = true;
      }
      this._pathCommand(ctx, command);
    }
  }

  _isPathCommand(command) {
    return ['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'closePath'].includes(command.op);
  }

  _pathCommand(ctx, command) {
    if (command.op === 'moveTo') ctx.moveTo?.(command.x, command.y);
    if (command.op === 'lineTo') ctx.lineTo?.(command.x, command.y);
    if (command.op === 'quadraticCurveTo') {
      ctx.quadraticCurveTo?.(command.cpx, command.cpy, command.x, command.y);
    }
    if (command.op === 'bezierCurveTo') {
      ctx.bezierCurveTo?.(
        command.cp1x,
        command.cp1y,
        command.cp2x,
        command.cp2y,
        command.x,
        command.y
      );
    }
    if (command.op === 'arc') {
      ctx.arc?.(command.x, command.y, command.radius, command.startAngle, command.endAngle, command.anticlockwise);
    }
    if (command.op === 'ellipse') {
      ctx.ellipse?.(
        command.x,
        command.y,
        command.radiusX,
        command.radiusY,
        command.rotation,
        command.startAngle,
        command.endAngle,
        command.anticlockwise
      );
    }
    if (command.op === 'rect') ctx.rect?.(command.x, command.y, command.width, command.height);
    if (command.op === 'polygon') {
      const [first, ...rest] = command.points;
      if (!first) return;
      ctx.moveTo?.(first.x, first.y);
      for (const point of rest) ctx.lineTo?.(point.x, point.y);
      ctx.closePath?.();
    }
    if (command.op === 'closePath') ctx.closePath?.();
  }

  _flushPath(ctx, state) {
    if (!state.pathOpen) return;
    this._paintPath(ctx, state);
    state.pathOpen = false;
  }

  _paintPath(ctx, state) {
    if (state.fill) {
      ctx.globalAlpha = this.alpha * state.fillAlpha;
      ctx.fillStyle = this._resolveFill(ctx, state.fill);
      ctx.fill?.();
    }
    if (state.stroke) {
      ctx.globalAlpha = this.alpha * state.strokeAlpha;
      ctx.strokeStyle = state.stroke;
      ctx.lineWidth = state.lineWidth;
      ctx.lineCap = state.cap;
      ctx.lineJoin = state.join;
      ctx.stroke?.();
    }
  }

  _resolveFill(ctx, fill) {
    if (!fill || typeof fill === 'string') return fill || '#ffffff';
    if (fill.kind === 'pattern') {
      const source = fill.sprite?.texture || fill.sprite;
      return ctx.createPattern?.(source, fill.repetition || 'repeat') || '#ffffff';
    }
    if (fill.kind === 'gradient') {
      const gradient = this._createCanvasGradient(ctx, fill);
      for (const stop of fill.colorStops) gradient?.addColorStop?.(stop.offset, stop.color);
      return gradient || '#ffffff';
    }
    return fill;
  }

  _createCanvasGradient(ctx, fill) {
    const bounds = fill.bounds || {};
    if (fill.type === 'radial') {
      return ctx.createRadialGradient?.(
        number(bounds.x0 ?? bounds.x),
        number(bounds.y0 ?? bounds.y),
        number(bounds.r0),
        number(bounds.x1 ?? bounds.x),
        number(bounds.y1 ?? bounds.y),
        number(bounds.r1 ?? bounds.radius, 1)
      );
    }
    if (fill.type === 'conic') {
      return ctx.createConicGradient?.(
        number(bounds.startAngle),
        number(bounds.x),
        number(bounds.y)
      ) || ctx.createLinearGradient?.(number(bounds.x), number(bounds.y), number(bounds.x) + 1, number(bounds.y));
    }
    return ctx.createLinearGradient?.(
      number(bounds.x0 ?? bounds.x),
      number(bounds.y0 ?? bounds.y),
      number(bounds.x1 ?? bounds.x + bounds.width),
      number(bounds.y1 ?? bounds.y)
    );
  }

  _applyBlend(ctx, mode) {
    ctx.globalCompositeOperation = BLEND_MODES[mode] || mode || 'source-over';
  }
}

export default Graphics;
