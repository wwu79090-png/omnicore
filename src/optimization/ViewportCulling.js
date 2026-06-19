/**
 * Viewport culling helper for large RPG maps.
 *
 * The system keeps render and update decisions data-driven. Any entity with
 * `cullable: false`, `alwaysUpdate`, or `alwaysRender` can opt out while Sprite
 * and Tilemap-like chunks use shared rectangle intersection checks.
 *
 * @example
 * const culling = new ViewportCulling({ viewport: { x: 0, y: 0, width: 960, height: 540 } });
 * if (culling.shouldRender(sprite)) sprite.render(ctx);
 */
export class ViewportCulling {
  constructor({
    viewport = null,
    padding = 64,
    enabled = true,
    maxVisibleTileChunks = null,
    offscreenUpdateWarningFrames = 0,
    offscreenWarningCooldownFrames = Number.POSITIVE_INFINITY,
    onLogicWarning = null,
    logger = console
  } = {}) {
    this.enabled = enabled;
    this.padding = padding;
    this.maxVisibleTileChunks = maxVisibleTileChunks;
    this.offscreenUpdateWarningFrames = Math.max(0, Number(offscreenUpdateWarningFrames) || 0);
    this.offscreenWarningCooldownFrames = Math.max(1, Number(offscreenWarningCooldownFrames) || Number.POSITIVE_INFINITY);
    this.onLogicWarning = onLogicWarning;
    this.logger = logger;
    this.logicActivity = new WeakMap();
    this.viewport = normalizeViewport(viewport || { x: 0, y: 0, width: 0, height: 0 });
  }

  setViewport(viewport = {}) {
    this.viewport = normalizeViewport(viewport);
    return this.viewport;
  }

  /**
   * Rebuilds the viewport from a camera and renderer dimensions.
   *
   * @param {object} camera Camera-like object.
   * @param {number} width Viewport width.
   * @param {number} height Viewport height.
   * @returns {object} Current viewport.
   */
  fromCamera(camera = {}, width = 0, height = 0) {
    const zoom = camera.zoomLevel || camera.zoom || 1;
    return this.setViewport({
      x: camera.x || 0,
      y: camera.y || 0,
      width: width / zoom,
      height: height / zoom
    });
  }

  syncFromGame(game) {
    if (!game) return this.viewport;
    const renderer = game.renderer || {};
    const width = renderer.width || game.config?.width || this.viewport.width;
    const height = renderer.height || game.config?.height || this.viewport.height;
    if (game.camera) return this.fromCamera(game.camera, width, height);
    return this.viewport;
  }

  getBounds(target = {}) {
    if (typeof target.getBounds === 'function') return normalizeBounds(target.getBounds());
    const scale = target.scale ?? 1;
    const scaleX = target.scaleX ?? scale;
    const scaleY = target.scaleY ?? scale;
    const width = (target.width ?? target.w ?? target.tileWidth ?? 0) * scaleX;
    const height = (target.height ?? target.h ?? target.tileHeight ?? 0) * scaleY;
    const anchorX = target.anchor?.x ? target.anchor.x * width : 0;
    const anchorY = target.anchor?.y ? target.anchor.y * height : 0;
    return normalizeBounds({
      x: (target.x ?? target.left ?? 0) - anchorX,
      y: (target.y ?? target.top ?? 0) - anchorY,
      width,
      height
    });
  }

  isVisible(target, viewport = this.viewport) {
    if (!this.enabled || !target) return true;
    if (target.visible === false) return false;
    if (target.cullable === false || target.alwaysRender || target.alwaysUpdate) return true;
    return this.isSpatiallyVisible(target, viewport);
  }

  isSpatiallyVisible(target, viewport = this.viewport) {
    if (!this.enabled || !target) return true;
    if (target.visible === false) return false;
    const bounds = this.getBounds(target);
    const padded = padViewport(viewport, this.padding);
    return intersects(bounds, padded);
  }

  shouldUpdate(target, viewport = this.viewport) {
    if (!this.enabled || !target) return true;
    if (target.updateOffscreen || target.alwaysUpdate || target.cullable === false) return true;
    return this.isVisible(target, viewport);
  }

  shouldRender(target, viewport = this.viewport) {
    if (!this.enabled || !target) return true;
    if (target.renderOffscreen || target.alwaysRender || target.cullable === false) return true;
    return this.isVisible(target, viewport);
  }

  filterVisible(items = [], viewport = this.viewport) {
    return items.filter((item) => this.shouldRender(item, viewport));
  }

  trackLogicActivity(target, {
    willUpdate = true,
    scene = null,
    delta = 0,
    time = 0,
    viewport = this.viewport
  } = {}) {
    if (!this.enabled || !this.offscreenUpdateWarningFrames || !target) return null;
    const offscreen = !this.isSpatiallyVisible(target, viewport);
    if (!willUpdate || !offscreen) {
      this.logicActivity.delete(target);
      return null;
    }

    const previous = this.logicActivity.get(target) || { frames: 0, lastWarnedFrame: 0 };
    const frames = previous.frames + 1;
    const shouldWarn = frames >= this.offscreenUpdateWarningFrames
      && (!previous.lastWarnedFrame || frames - previous.lastWarnedFrame >= this.offscreenWarningCooldownFrames);
    const next = {
      frames,
      lastWarnedFrame: shouldWarn ? frames : previous.lastWarnedFrame
    };
    this.logicActivity.set(target, next);

    if (!shouldWarn) return null;

    const payload = {
      type: 'offscreen-logic-active',
      entityId: target.id || target.name || null,
      entityName: target.name || target.id || null,
      framesOffscreen: frames,
      delta,
      time,
      scene: scene?.name || null,
      recommendation: 'Mark this entity sleepable, remove alwaysUpdate, or move long-running logic into a wake/sleep system.'
    };
    if (this.onLogicWarning) this.onLogicWarning(payload);
    else this.logger?.warn?.('[OmniCore] Offscreen entity is still running logic', payload);
    return payload;
  }

  /**
   * Returns visible Tilemap chunks for chunked map renderers.
   *
   * @param {object} tilemap Tilemap-like object with width/height/tileWidth/tileHeight.
   * @param {number} chunkSize Tile count per chunk edge.
   * @returns {Array<object>} Visible chunk rectangles in tile coordinates.
   */
  visibleTileChunks(tilemap = {}, chunkSize = tilemap.chunkSize || 16) {
    const tileWidth = tilemap.tileWidth || tilemap.tilewidth || 16;
    const tileHeight = tilemap.tileHeight || tilemap.tileheight || 16;
    const mapWidth = tilemap.width || 0;
    const mapHeight = tilemap.height || 0;
    const viewport = padViewport(this.viewport, this.padding);
    const minTileX = clamp(Math.floor(viewport.x / tileWidth), 0, mapWidth);
    const minTileY = clamp(Math.floor(viewport.y / tileHeight), 0, mapHeight);
    const maxTileX = clamp(Math.ceil((viewport.x + viewport.width) / tileWidth), 0, mapWidth);
    const maxTileY = clamp(Math.ceil((viewport.y + viewport.height) / tileHeight), 0, mapHeight);
    const chunks = [];

    for (let y = Math.floor(minTileY / chunkSize) * chunkSize; y < maxTileY; y += chunkSize) {
      for (let x = Math.floor(minTileX / chunkSize) * chunkSize; x < maxTileX; x += chunkSize) {
        chunks.push({
          x,
          y,
          width: Math.min(chunkSize, mapWidth - x),
          height: Math.min(chunkSize, mapHeight - y)
        });
      }
    }

    if (Number.isFinite(this.maxVisibleTileChunks) && this.maxVisibleTileChunks > 0) {
      return chunks.slice(0, this.maxVisibleTileChunks);
    }
    return chunks;
  }
}

function normalizeViewport(viewport = {}) {
  return {
    x: Number(viewport.x || 0),
    y: Number(viewport.y || 0),
    width: Number(viewport.width || 0),
    height: Number(viewport.height || 0)
  };
}

function normalizeBounds(bounds = {}) {
  return {
    x: Number(bounds.x || 0),
    y: Number(bounds.y || 0),
    width: Math.max(0, Number(bounds.width || 0)),
    height: Math.max(0, Number(bounds.height || 0))
  };
}

function padViewport(viewport, padding) {
  return {
    x: viewport.x - padding,
    y: viewport.y - padding,
    width: viewport.width + padding * 2,
    height: viewport.height + padding * 2
  };
}

function intersects(left, right) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default ViewportCulling;
