/* global __OMNICORE_DEBUG_RENDERER__ */

const DEBUG_RENDERER_BUILD = typeof __OMNICORE_DEBUG_RENDERER__ === 'boolean'
  ? __OMNICORE_DEBUG_RENDERER__
  : true;

class DebugRendererNoop {
  constructor() {
    this.debug = false;
    this.overlay = null;
    this.commands = [];
  }

  drawLine() {
    return null;
  }

  drawCircle() {
    return null;
  }

  drawAABB() {
    return null;
  }

  drawTextAt() {
    return null;
  }

  drawColliderRects() {
    return [];
  }

  drawPhysicsWorld() {
    return [];
  }

  flush() {
    this.commands.length = 0;
    return 0;
  }

  clear() {
    this.commands.length = 0;
  }
}

function normalizeColor(color = 0xffffff) {
  if (typeof color === 'number' || typeof color === 'string') return color;
  return 0xffffff;
}

function colorForPixi(color) {
  if (typeof color === 'number') return color;
  if (typeof color === 'string' && color.startsWith('#')) return Number.parseInt(color.slice(1), 16);
  return 0xffffff;
}

export function isDebugBuildEnabled({ debug = false, mode = 'development' } = {}) {
  return DEBUG_RENDERER_BUILD && Boolean(debug) && mode !== 'production';
}

const DebugRendererBase = DEBUG_RENDERER_BUILD ? class DebugRendererImpl {
  constructor({ debug = false, mode = 'development', overlay = null } = {}) {
    this.debug = isDebugBuildEnabled({ debug, mode });
    this.overlay = overlay;
    this.commands = [];
  }

  drawLine(x1, y1, x2, y2, color = 0xffffff) {
    if (!this.debug) return null;
    return this._push({
      type: 'line',
      x1,
      y1,
      x2,
      y2,
      color: normalizeColor(color)
    });
  }

  drawCircle(x, y, radius, color = 0xffffff) {
    if (!this.debug) return null;
    return this._push({
      type: 'circle',
      x,
      y,
      radius,
      color: normalizeColor(color)
    });
  }

  drawAABB(rect = {}, color = 0xffffff) {
    if (!this.debug) return null;
    return this._push({
      type: 'aabb',
      x: rect.x ?? 0,
      y: rect.y ?? 0,
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      color: normalizeColor(color)
    });
  }

  drawTextAt(x = 0, y = 0, text = '', color = 0xffffff) {
    if (!this.debug) return null;
    return this._push({
      type: 'text',
      x: Number(x || 0),
      y: Number(y || 0),
      text: String(text ?? ''),
      color: normalizeColor(color)
    });
  }

  drawColliderRects(source = [], {
    activeColor = 0x22c55e,
    inactiveColor = 0x64748b,
    sensorColor = 0xef4444
  } = {}) {
    if (!this.debug) return [];
    return collectColliderRects(source)
      .map((rect) => this.drawAABB(rect, rect.sensor ? sensorColor : (rect.active === false ? inactiveColor : activeColor)))
      .filter(Boolean);
  }

  drawPhysicsWorld(world = {}, {
    bodyColor = 0x22c55e,
    sensorColor = 0xef4444,
    staticColor = 0x38bdf8
  } = {}) {
    if (!this.debug) return [];
    const commands = [];
    for (const body of collectBodies(world)) {
      const color = body?.isSensor ? sensorColor : bodyColor;
      if (Number.isFinite(body?.circleRadius) && body?.position) {
        commands.push(this.drawCircle(body.position.x || 0, body.position.y || 0, body.circleRadius, color));
        continue;
      }
      const bounds = boundsFromBody(body);
      if (bounds) commands.push(this.drawAABB(bounds, color));
    }
    for (const polygon of world?.staticCollisionPolygons || []) {
      commands.push(this.drawAABB(polygon, staticColor));
    }
    return commands.filter(Boolean);
  }

  flush(overlay = this.overlay) {
    if (!this.debug || !overlay) {
      this.commands.length = 0;
      return 0;
    }
    overlay.clear?.();
    for (const command of this.commands) this._drawCommand(overlay, command);
    const count = this.commands.length;
    this.commands.length = 0;
    return count;
  }

  clear() {
    this.commands.length = 0;
  }

  _push(command) {
    this.commands.push(command);
    return command;
  }

  _drawCommand(overlay, command) {
    if (typeof overlay.draw === 'function') {
      overlay.draw(command);
      return;
    }
    if (command.type === 'line') this._drawLine(overlay, command);
    else if (command.type === 'circle') this._drawCircle(overlay, command);
    else if (command.type === 'aabb') this._drawAABB(overlay, command);
    else if (command.type === 'text') this._drawText(overlay, command);
  }

  _drawLine(overlay, command) {
    if (typeof overlay.lineStyle === 'function') {
      overlay.lineStyle(1, colorForPixi(command.color), 1);
      overlay.moveTo?.(command.x1, command.y1);
      overlay.lineTo?.(command.x2, command.y2);
      return;
    }
    overlay.moveTo?.(command.x1, command.y1);
    overlay.lineTo?.(command.x2, command.y2);
    overlay.stroke?.({ width: 1, color: colorForPixi(command.color), alpha: 1 });
  }

  _drawCircle(overlay, command) {
    if (typeof overlay.drawCircle === 'function') {
      overlay.lineStyle?.(1, colorForPixi(command.color), 1);
      overlay.drawCircle(command.x, command.y, command.radius);
      return;
    }
    overlay.circle?.(command.x, command.y, command.radius);
    overlay.stroke?.({ width: 1, color: colorForPixi(command.color), alpha: 1 });
  }

  _drawAABB(overlay, command) {
    if (typeof overlay.drawRect === 'function') {
      overlay.lineStyle?.(1, colorForPixi(command.color), 1);
      overlay.drawRect(command.x, command.y, command.width, command.height);
      return;
    }
    overlay.rect?.(command.x, command.y, command.width, command.height);
    overlay.stroke?.({ width: 1, color: colorForPixi(command.color), alpha: 1 });
  }

  _drawText(overlay, command) {
    if (typeof overlay.fillText === 'function') {
      overlay.fillStyle = typeof command.color === 'string' ? command.color : `#${colorForPixi(command.color).toString(16).padStart(6, '0')}`;
      overlay.fillText(command.text, command.x, command.y);
      return;
    }
    overlay.text?.(command.text, command.x, command.y, { color: colorForPixi(command.color) });
  }
} : DebugRendererNoop;

export class DebugRenderer extends DebugRendererBase {}

function createNoopDebugAPI() {
  return {
    enabled: false,
    renderer: null,
    configure(options = {}) {
      if (!isDebugBuildEnabled(options)) return this;
      return createDebugAPI(options);
    },
    drawLine: () => null,
    drawCircle: () => null,
    drawAABB: () => null,
    drawTextAt: () => null,
    drawColliderRects: () => [],
    drawPhysicsWorld: () => [],
    flush: () => 0,
    clear: () => {}
  };
}

export function createDebugAPI(options = {}) {
  if (!isDebugBuildEnabled(options)) return createNoopDebugAPI();
  const renderer = new DebugRenderer(options);
  return {
    enabled: true,
    renderer,
    configure(nextOptions = {}) {
      return createDebugAPI(nextOptions);
    },
    drawLine: (...args) => renderer.drawLine(...args),
    drawCircle: (...args) => renderer.drawCircle(...args),
    drawAABB: (...args) => renderer.drawAABB(...args),
    drawTextAt: (...args) => renderer.drawTextAt(...args),
    drawColliderRects: (...args) => renderer.drawColliderRects(...args),
    drawPhysicsWorld: (...args) => renderer.drawPhysicsWorld(...args),
    flush: (...args) => renderer.flush(...args),
    clear: () => renderer.clear()
  };
}

function collectBodies(world = {}) {
  const bodies = world?.engine?.world?.bodies || world?.bodies || [];
  return Array.isArray(bodies) ? bodies : [...bodies];
}

function collectColliderRects(source = []) {
  const values = Array.isArray(source)
    ? source
    : [
      ...(source.colliderRects || source.colliders || []),
      ...(source.children || []).flatMap((child) => child.colliderRects || child.colliders || child.collider || [])
    ];
  return values
    .filter(Boolean)
    .map((item) => {
      const rect = item.bounds || item.rect || item;
      return {
        x: Number(rect.x ?? rect.left ?? 0),
        y: Number(rect.y ?? rect.top ?? 0),
        width: Number(rect.width ?? rect.w ?? Math.max(0, Number(rect.right || 0) - Number(rect.left || 0))),
        height: Number(rect.height ?? rect.h ?? Math.max(0, Number(rect.bottom || 0) - Number(rect.top || 0))),
        active: item.active,
        sensor: Boolean(item.sensor || item.isSensor)
      };
    });
}

function boundsFromBody(body = {}) {
  if (body.bounds?.min && body.bounds?.max) {
    return {
      x: Number(body.bounds.min.x || 0),
      y: Number(body.bounds.min.y || 0),
      width: Math.max(0, Number(body.bounds.max.x || 0) - Number(body.bounds.min.x || 0)),
      height: Math.max(0, Number(body.bounds.max.y || 0) - Number(body.bounds.min.y || 0))
    };
  }
  if (Number.isFinite(body.x) || Number.isFinite(body.width) || Number.isFinite(body.height)) {
    return {
      x: Number(body.x || 0),
      y: Number(body.y || 0),
      width: Number(body.width || 0),
      height: Number(body.height || 0)
    };
  }
  if (body.position && (Number.isFinite(body.width) || Number.isFinite(body.height))) {
    const width = Number(body.width || 0);
    const height = Number(body.height || 0);
    return {
      x: Number(body.position.x || 0) - width / 2,
      y: Number(body.position.y || 0) - height / 2,
      width,
      height
    };
  }
  return null;
}

export default DebugRenderer;
