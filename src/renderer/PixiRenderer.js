import {
  Application,
  Container,
  Graphics,
  Sprite as PixiSprite,
  Text,
  Texture
} from 'pixi.js';
import { appendFilter, createAdjustmentFilter, createBloomFilter, createGlitchFilter } from './Filters.js';
import RenderLayerManager from './RenderLayerManager.js';
import BatchOptimizer from './BatchOptimizer.js';
import PixiBatchAdapter from './PixiBatchAdapter.js';
import { createNoopCanvasContext } from '../core/Bootstrap.js';
import { FixedMemoryPool } from '../core/MemoryPool.js';
import { DEFAULT_RENDERER_CONFIG } from '../config/defaults.js';

function renderCanvasSpriteFast(ctx, child) {
  if (!ctx || child?.type !== 'sprite' || child.visible === false) return false;
  const scaleX = child.scaleX ?? 1;
  const scaleY = child.scaleY ?? 1;
  const anchor = child.anchor || { x: 0, y: 0 };
  const imageCtor = globalThis.HTMLImageElement;
  const canvasCtor = globalThis.HTMLCanvasElement;
  const isDrawableTexture = (imageCtor && child.texture instanceof imageCtor)
    || (canvasCtor && child.texture instanceof canvasCtor);
  if (
    isDrawableTexture
    || child.label !== false
    || child.rotation
    || scaleX !== 1
    || scaleY !== 1
    || anchor.x
    || anchor.y
  ) {
    return false;
  }
  ctx.globalAlpha = child.alpha ?? 1;
  ctx.fillStyle = child.color || '#38bdf8';
  ctx.fillRect(child.x || 0, child.y || 0, child.width || 32, child.height || 32);
  return true;
}

function preparePixiApplicationDestroy(app) {
  if (!app || typeof app._cancelResize === 'function') return;
  try {
    Object.defineProperty(app, '_cancelResize', {
      value: () => {},
      configurable: true,
      writable: true
    });
  } catch {
    app._cancelResize = () => {};
  }
}

function isPixiNullDestroyError(error) {
  return /Cannot read properties of null \(reading 'destroy'\)/.test(error?.message || '');
}

/**
 * PixiJS v8 backed 2D renderer with Canvas fallback.
 *
 * Pixi lifecycle is sealed behind this wrapper. OmniCore does not expose
 * Pixi's ticker; rendering is driven by OmniCore.Loop.
 *
 * @example
 * const renderer = new PixiRenderer({ backend: 'pixi', canvas, width: 800, height: 600 });
 * await renderer.init();
 * renderer.applyBloom(sprite.displayObject);
 */
export class PixiRenderer {
  constructor({
    backend = DEFAULT_RENDERER_CONFIG.backend,
    canvas,
    width = DEFAULT_RENDERER_CONFIG.width,
    height = DEFAULT_RENDERER_CONFIG.height,
    background = DEFAULT_RENDERER_CONFIG.background,
    autoResize = DEFAULT_RENDERER_CONFIG.autoResize,
    store,
    fallbackReason = null,
    autoZReorder = true,
    isMobile = false,
    particleLimit = 1000,
    enableBloom = true,
    metrics = null,
    commandBuffer = false,
    commandCapacity = 4096,
    spritePoolSize = 2048,
    debugRenderer = null
  } = {}) {
    this.backend = backend;
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.background = background;
    this.autoResize = autoResize;
    this.store = store;
    this.fallbackReason = fallbackReason;
    this.autoZReorder = autoZReorder;
    this.isMobile = isMobile;
    this.particleLimit = particleLimit;
    this.enableBloom = enableBloom;
    this.metrics = metrics;
    this.commandBufferEnabled = Boolean(commandBuffer);
    this.commandCapacity = commandCapacity;
    this.spritePoolSize = spritePoolSize;
    this.debugRenderer = debugRenderer;
    this.app = null;
    this.stage = null;
    this.ctx = null;
    this.destroyed = false;
    this.sceneDisplayObjects = new Map();
    this.displayPools = new Map();
    this.entitySnapshots = new Map();
    this.sceneTextures = new Map();
    this.textureCache = new Map();
    this.unsubscribeEntities = null;
    this.layerManager = null;
    this.batchOptimizer = new BatchOptimizer();
    this.batchAdapter = this.commandBufferEnabled ? new PixiBatchAdapter({ capacity: commandCapacity }) : null;
    this.batchStats = null;
    this.batchStatsDirty = true;
    this.lastBatchChildCount = 0;
    this.qualityProfile = null;
    this.events = null;
    this.nextDisplayId = 1;
    this.spritePool = null;
    this.debugOverlay = null;
    this.lastSceneDiff = null;
    this.applyMobileOptimizations();
  }

  async init() {
    if (this.backend === 'canvas') {
      this.ctx = this._getCanvasContext();
      this.store?.injectBackend(this.backend);
      this.bindStore(this.store);
      return this;
    }

    try {
      this.app = new Application();
      await this.app.init({
        canvas: this.canvas,
        width: this.width,
        height: this.height,
        background: this.background,
        preference: 'webgl',
        autoStart: false,
        sharedTicker: false,
        resizeTo: this.autoResize && typeof window !== 'undefined' ? window : undefined
      });
      this.stage = new Container();
      this.app.stage.addChild(this.stage);
      this.layerManager = new RenderLayerManager({ store: this.store, container: this.stage });
      this.canvas = this.app.canvas;
      this._ensureSpritePool();
      this.store?.injectBackend(this.backend);
      this.bindStore(this.store);
      return this;
    } catch (error) {
      this.backend = 'canvas';
      this.fallbackReason = error;
      this.ctx = this._getCanvasContext();
      this.store?.injectBackend(this.backend);
      this.bindStore(this.store);
      this._drawFallbackOverlay();
      return this;
    }
  }

  renderScene(scene) {
    if (!scene) return;
    const render = () => {
      if (this.backend === 'canvas') {
        this._renderCanvas(scene);
        this._flushDebugOverlay();
        return;
      }
      if (this.batchAdapter) this._renderCommandBufferedScene(scene);
      else this._syncPixiScene(scene);
      this._flushDebugOverlay();
      this.app?.renderer?.render?.(this.app.stage);
    };
    if (this.metrics?.measure) this.metrics.measure('renderer.renderScene', render);
    else render();
  }

  render(scene) {
    this.renderScene(scene);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.app?.renderer?.resize?.(width, height);
  }

  fade(direction = 'out', duration = 250) {
    return new Promise((resolve) => {
      if (!duration) {
        resolve();
        return;
      }
      setTimeout(resolve, duration);
      this.store?.set('transition', { direction, duration, startedAt: Date.now() });
    });
  }

  applyBloom(target, options = {}) {
    if (!this.enableBloom) return null;
    return appendFilter(target, createBloomFilter(options));
  }

  applyGlitch(target, options = {}) {
    return appendFilter(target, createGlitchFilter(options));
  }

  applyMobileOptimizations() {
    if (!this.isMobile) return this;
    this.particleLimit = Math.min(this.particleLimit, 300);
    this.enableBloom = false;
    return this;
  }

  setQualityProfile(profile = {}) {
    this.qualityProfile = { ...profile };
    if (profile.tier === 'low') {
      this.enableBloom = false;
      this.particleLimit = Math.min(this.particleLimit, 400);
    }
    this.store?.set?.('renderer:qualityProfile', this.qualityProfile);
    return this.qualityProfile;
  }

  negotiateAddonContract(contract = {}) {
    const requestedFps = contract.requestAnimationFrame?.samplingRate || 60;
    const drawCalls = this.batchStats?.drawCalls || this.store?.get?.('renderer:drawCalls') || 0;
    const fps = this.store?.get?.('fps') || requestedFps;
    if (drawCalls > 500 || fps < requestedFps * 0.85) {
      return {
        status: 'busy',
        samplingRateScale: 0.5,
        drawCalls,
        fps
      };
    }
    return {
      status: 'ok',
      drawCalls,
      fps
    };
  }

  releaseSceneTextures(activeScene = null) {
    const active = new Set((activeScene?.children || []).map((child) => child.texture).filter(Boolean));
    for (const [key, texture] of [...this.sceneTextures.entries()]) {
      if (active.has(key)) continue;
      texture?.destroy?.(true);
      this.sceneTextures.delete(key);
    }
  }

  applyAdjustment(target, options = {}) {
    return appendFilter(target, createAdjustmentFilter(options));
  }

  destroy() {
    this.destroyed = true;
    const canvas = this.canvas || this.app?.canvas;
    if (this.app) {
      this._preparePixiApplicationDestroy(this.app);
      try {
        this.app.destroy(
          { removeView: true },
          { children: true, texture: true, textureSource: true, context: true }
        );
      } catch (firstError) {
        if (isPixiNullDestroyError(firstError)) {
          this.app = null;
        } else {
          this._preparePixiApplicationDestroy(this.app);
          try {
            this.app.destroy(true, true);
          } catch (secondError) {
            if (isPixiNullDestroyError(secondError)) {
              this.app = null;
            } else {
              secondError.cause = secondError.cause || firstError;
              throw secondError;
            }
          }
        }
      }
    } else if (this.canvas?.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
    this.app = null;
    this.stage = null;
    this.ctx = null;
    this.canvas = null;
    this.sceneDisplayObjects.clear();
    this.displayPools.clear();
    this.entitySnapshots.clear();
    this.textureCache.clear();
    this.layerManager?.destroy?.();
    this.layerManager = null;
    this.unsubscribeEntities?.();
    this.unsubscribeEntities = null;
  }

  _preparePixiApplicationDestroy(app = this.app) {
    return preparePixiApplicationDestroy(app);
  }

  bindStore(store = this.store, events = this.events) {
    if (!store?.subscribe || this.unsubscribeEntities) return this;
    this.store = store;
    this.events = events || this.events;
    this.unsubscribeEntities = store.subscribe('entities', (entities = []) => {
      this._applyEntityDiff(Array.isArray(entities) ? entities : []);
    });
    return this;
  }

  _ensureSpritePool() {
    if (this.backend === 'canvas' || this.spritePool || this.spritePoolSize <= 0) return null;
    this.spritePool = new FixedMemoryPool('pixi-sprite-display-objects', this.spritePoolSize, {
      factory: () => new PixiSprite(Texture.EMPTY),
      reset: (sprite) => {
        sprite.texture = Texture.EMPTY;
        sprite.visible = false;
        sprite.alpha = 1;
        sprite.rotation = 0;
        sprite.x = 0;
        sprite.y = 0;
        sprite.tint = 0xffffff;
        sprite.scale?.set?.(1, 1);
        sprite.parent?.removeChild?.(sprite);
      }
    });
    return this.spritePool;
  }

  _flushDebugOverlay() {
    if (!this.debugRenderer) return 0;
    if (this.backend === 'canvas') {
      const ctx = this.ctx || this._getCanvasContext();
      return this.debugRenderer.flush({
        clear: () => {},
        draw: (command) => this._drawCanvasDebugCommand(ctx, command)
      });
    }
    if (!this.app?.stage) return 0;
    if (!this.debugOverlay) {
      this.debugOverlay = new Graphics();
      this.debugOverlay.eventMode = 'none';
      this.debugOverlay.interactive = false;
      this.app.stage.addChild(this.debugOverlay);
    } else if (this.debugOverlay.parent !== this.app.stage) {
      this.app.stage.addChild(this.debugOverlay);
    }
    if (typeof this.app.stage.setChildIndex === 'function') {
      this.app.stage.setChildIndex(this.debugOverlay, this.app.stage.children.length - 1);
    }
    return this.debugRenderer.flush(this.debugOverlay);
  }

  _drawCanvasDebugCommand(ctx, command) {
    if (!ctx) return;
    ctx.save?.();
    ctx.strokeStyle = typeof command.color === 'number'
      ? `#${command.color.toString(16).padStart(6, '0')}`
      : command.color;
    ctx.beginPath?.();
    if (command.type === 'line') {
      ctx.moveTo?.(command.x1, command.y1);
      ctx.lineTo?.(command.x2, command.y2);
    } else if (command.type === 'circle') {
      ctx.arc?.(command.x, command.y, command.radius, 0, Math.PI * 2);
    } else if (command.type === 'aabb') {
      ctx.rect?.(command.x, command.y, command.width, command.height);
    }
    ctx.stroke?.();
    ctx.restore?.();
  }

  _getCanvasContext() {
    try {
      return this.canvas?.getContext?.('2d') || createNoopCanvasContext();
    } catch {
      return createNoopCanvasContext();
    }
  }

  _renderCanvas(scene) {
    const ctx = this.ctx || this._getCanvasContext();
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.width, this.height);
    for (const child of this._visibleChildren(scene).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))) {
      if (renderCanvasSpriteFast(ctx, child)) continue;
      child.render?.(ctx);
    }
    ctx.globalAlpha = 1;
    this._drawFallbackOverlay(ctx);
  }

  _drawFallbackOverlay(ctx = this.ctx) {
    if (!this.fallbackReason || !ctx) return;
    const message = this.fallbackReason?.message || String(this.fallbackReason);
    ctx.save?.();
    ctx.fillStyle = 'rgba(220, 38, 38, 0.32)';
    ctx.fillRect?.(0, 0, this.width, this.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.fillText?.('OmniCore Canvas fallback', 16, 28);
    ctx.fillText?.(message.slice(0, 80), 16, 48);
    ctx.restore?.();
  }

  _renderCommandBufferedScene(scene) {
    if (!this.stage || !this.batchAdapter) return;
    const nextKeys = new Set();
    const children = this._visibleChildren(scene, { copy: false });
    this.batchAdapter.reset();

    for (const child of children) {
      if (child.type === 'sprite') {
        this._enqueueDrawCall(child);
        continue;
      }
      const key = this._childKey(child);
      const poolKey = this._poolKey(child);
      const existing = this.sceneDisplayObjects.get(key);
      const displayObject = existing?.displayObject && !existing.displayObject.destroyed
        ? existing.displayObject
        : this._ensurePixiDisplayObject(child, poolKey);
      if (!displayObject) continue;
      child.displayObject = displayObject;
      this._syncDisplayObject(child, displayObject);
      this.sceneDisplayObjects.set(key, {
        child,
        displayObject,
        poolKey,
        zIndex: child.zIndex || 0
      });
      nextKeys.add(key);
      if (!this._stageContains(displayObject)) this.stage.addChild(displayObject);
    }

    if (this.batchAdapter.forceBatchFlushNeeded()) {
      this.batchAdapter.forceBatchFlush((commands) => this._submitCommandBuffer(commands, nextKeys));
    } else {
      this.batchAdapter.flush((commands) => this._submitCommandBuffer(commands, nextKeys));
    }
    this._removeMissingDisplayObjects(nextKeys);
    this._updateCommandBufferStats(children);
  }

  _enqueueDrawCall(child) {
    this.batchAdapter.drawSprite({
      child,
      texture: child.texture,
      textureKey: this._textureCommandKey(child),
      x: child.x || 0,
      y: child.y || 0,
      width: child.width || 0,
      height: child.height || 0,
      scaleX: child.scaleX ?? child.scale ?? 1,
      scaleY: child.scaleY ?? child.scale ?? 1,
      rotation: child.rotation || 0,
      alpha: child.alpha ?? 1,
      zIndex: child.zIndex || 0,
      color: child.color ?? child.tint ?? 0xffffff,
      blendMode: child.blendMode || 'normal'
    });
  }

  _submitCommandBuffer(commands, nextKeys) {
    let order = 0;
    commands.forEach((command) => {
      const { child } = command;
      if (!child) return;
      const key = this._childKey(child);
      const poolKey = this._poolKey(child);
      const existing = this.sceneDisplayObjects.get(key);
      const displayObject = existing?.displayObject && !existing.displayObject.destroyed
        ? existing.displayObject
        : this._ensurePixiDisplayObject(child, poolKey);
      if (!displayObject) return;

      child.displayObject = displayObject;
      child.sprite = displayObject;
      child.x = command.x;
      child.y = command.y;
      child.zIndex = command.zIndex;
      child.alpha = command.alpha;
      child.scaleX = command.scaleX;
      child.scaleY = command.scaleY;
      this._syncDisplayObject(child, displayObject);
      if (!existing || existing.displayObject !== displayObject || existing.zIndex !== command.zIndex) {
        this.sceneDisplayObjects.set(key, {
          child,
          displayObject,
          poolKey,
          zIndex: command.zIndex
        });
      }
      nextKeys.add(key);
      if (!this._stageContains(displayObject)) this.stage.addChild(displayObject);
      if (this.stage.children?.[order] !== displayObject && typeof this.stage.setChildIndex === 'function') {
        this.stage.setChildIndex(displayObject, Math.min(order, this.stage.children.length - 1));
      }
      order += 1;
    });
  }

  _removeMissingDisplayObjects(nextKeys) {
    if (this.sceneDisplayObjects.size === nextKeys.size) return 0;
    let removed = 0;
    for (const [key, record] of this.sceneDisplayObjects.entries()) {
      if (nextKeys.has(key)) continue;
      this._releaseSceneRecord(key, record);
      removed += 1;
    }
    return removed;
  }

  _releaseSceneRecord(key, record = {}) {
    this.stage?.removeChild?.(record.displayObject);
    if (record.child?.displayObject === record.displayObject) record.child.displayObject = null;
    if (record.child?.sprite === record.displayObject) record.child.sprite = null;
    this.sceneDisplayObjects.delete(key);
    this.layerManager?.unregister?.(this._renderLayerId(record.child, key));
    this._releaseDisplayObject(record.poolKey, record.displayObject);
    this.batchStatsDirty = true;
  }

  _textureCommandKey(child) {
    if (child.batchKey) return child.batchKey;
    if (child.atlasKey) return `atlas:${child.atlasKey}`;
    if (child.atlas) return `atlas:${child.atlas}`;
    return String(child.texture || 'empty');
  }

  _updateCommandBufferStats(children = []) {
    const drawCalls = this.batchAdapter?.lastFlushStats.textureBatches || 0;
    const spriteCount = this.batchAdapter?.lastFlushStats.commands || 0;
    const nonBatchableCount = Math.max(0, children.length - spriteCount);
    this.batchStats = {
      drawCalls,
      batchCount: drawCalls,
      spriteCount,
      nonBatchableCount,
      fpsTarget: drawCalls <= 1 ? 60 : Math.max(1, 60 - drawCalls + 1),
      batchKeys: []
    };
    this.batchStatsDirty = false;
    this.lastBatchChildCount = children.length;
    this.store?.set?.('renderer:drawCalls', this.batchStats.drawCalls);
    this.store?.set?.('renderer:batchStats', this.batchStats);
    return this.batchStats;
  }

  _syncPixiScene(scene) {
    if (!this.stage) return;
    const children = this._visibleChildren(scene);
    const diff = this._createSceneDiff(children);
    const stats = this._applySceneDiff(diff);
    this.lastSceneDiff = stats;
    this.store?.set?.('renderer:sceneDiff', stats);
    this._applyStageOrder(children);
    this._updateBatchStats(children);
  }

  _createSceneDiff(children = []) {
    const nextKeys = new Set();
    const upserts = [];
    for (const child of children) {
      const key = this._childKey(child);
      const poolKey = this._poolKey(child);
      const existing = this.sceneDisplayObjects.get(key);
      const zIndex = child.zIndex || 0;
      nextKeys.add(key);
      upserts.push({ key, child, poolKey, existing, zIndex });
    }

    const removals = [];
    for (const [key, record] of this.sceneDisplayObjects.entries()) {
      if (!nextKeys.has(key)) removals.push({ key, record });
    }

    return { children, nextKeys, upserts, removals };
  }

  _applySceneDiff(diff) {
    const stats = {
      added: 0,
      updated: 0,
      removed: 0,
      pooled: 0,
      total: diff.upserts.length
    };

    for (const entry of diff.upserts) {
      const { key, child, poolKey, existing, zIndex } = entry;
      const displayObject = existing?.displayObject && !existing.displayObject.destroyed
        ? existing.displayObject
        : this._ensurePixiDisplayObject(child, poolKey);
      if (!displayObject) continue;

      child.displayObject = displayObject;
      child.sprite = displayObject;
      this._syncDisplayObject(child, displayObject);
      if (!existing) stats.added += 1;
      else stats.updated += 1;
      if (!existing && String(displayObject.__omnicoreAcquireSource || '').includes('pool')) stats.pooled += 1;
      if (!existing || existing.displayObject !== displayObject || existing.zIndex !== zIndex) {
        this.layerManager?.register?.(this._renderLayerId(child, key), displayObject, zIndex);
        this.sceneDisplayObjects.set(key, { child, displayObject, poolKey, zIndex });
      }
      if (!this._stageContains(displayObject)) this.stage.addChild(displayObject);
    }

    for (const { key, record } of diff.removals) {
      this._releaseSceneRecord(key, record);
      stats.removed += 1;
    }
    return stats;
  }

  _applyEntityDiff(entities) {
    const nextKeys = new Set();
    for (const entity of entities) {
      const key = this._childKey(entity);
      const snapshot = JSON.stringify(entity);
      const existing = this.sceneDisplayObjects.get(key);
      const displayObject = existing?.displayObject && !existing.displayObject.destroyed
        ? existing.displayObject
        : this._ensurePixiDisplayObject(entity);
      if (!displayObject) continue;

      entity.displayObject = displayObject;
      entity.sprite = displayObject;
      this._syncDisplayObject(entity, displayObject);
      this.layerManager?.register?.(this._renderLayerId(entity, key), displayObject, entity.zIndex || 0);
      this.sceneDisplayObjects.set(key, { child: entity, displayObject, poolKey: this._poolKey(entity) });
      nextKeys.add(key);

      if (!existing) {
        if (this.stage && !this._stageContains(displayObject)) this.stage.addChild?.(displayObject);
        this.events?.emit?.('renderer:entity-add', { id: entity.id || entity.name || key, entity, displayObject });
      } else if (this.entitySnapshots.get(key) !== snapshot) {
        this.events?.emit?.('renderer:entity-update', { id: entity.id || entity.name || key, entity, displayObject });
      }
      this.entitySnapshots.set(key, snapshot);
    }

    for (const [key, record] of [...this.sceneDisplayObjects.entries()]) {
      if (nextKeys.has(key)) continue;
      this.stage?.removeChild?.(record.displayObject);
      if (record.child?.displayObject === record.displayObject) record.child.displayObject = null;
      if (record.child?.sprite === record.displayObject) record.child.sprite = null;
      this.sceneDisplayObjects.delete(key);
      this.entitySnapshots.delete(key);
      this.layerManager?.unregister?.(this._renderLayerId(record.child, key));
      this._releaseDisplayObject(record.poolKey, record.displayObject);
      this.batchStatsDirty = true;
      this.events?.emit?.('renderer:entity-remove', { id: record.child?.id || record.child?.name || key, entity: record.child });
    }

    if (this.backend === 'canvas') this._renderEntitiesCanvas(entities);
    else {
      this._updateBatchStats(entities);
      this.app?.renderer?.render?.(this.app.stage);
    }
  }

  _renderEntitiesCanvas(entities) {
    const ctx = this.ctx || this._getCanvasContext();
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.width, this.height);
    for (const entity of [...entities].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))) {
      if (entity.render) entity.render(ctx);
      else this._renderPlainEntity(ctx, entity);
    }
    this._drawFallbackOverlay(ctx);
  }

  _renderPlainEntity(ctx, entity) {
    if (entity.visible === false) return;
    ctx.save?.();
    ctx.globalAlpha = entity.alpha ?? 1;
    ctx.translate?.(entity.x || 0, entity.y || 0);
    ctx.rotate?.(entity.rotation || 0);
    ctx.scale?.(entity.scaleX ?? entity.scale ?? 1, entity.scaleY ?? entity.scale ?? 1);
    ctx.fillStyle = entity.color || '#38bdf8';
    ctx.fillRect?.(0, 0, entity.width || 32, entity.height || 32);
    ctx.restore?.();
  }

  _visibleChildren(scene, { copy = true } = {}) {
    if (!scene?.children) return [];
    const culling = scene.game?.culling;
    culling?.syncFromGame?.(scene.game);
    const children = copy ? [...scene.children] : scene.children;
    if (!culling?.shouldRender) return children;
    return children.filter((child) => {
      const visible = culling.shouldRender(child);
      child.__omnicoreRenderCulled = !visible;
      return visible;
    });
  }

  _ensurePixiDisplayObject(child, poolKey = this._poolKey(child)) {
    const previousDisplayObject = child.displayObject;
    if (previousDisplayObject?.destroyed) {
      child.displayObject = null;
      if (child.sprite === previousDisplayObject) child.sprite = null;
    }
    if (child.displayObject) {
      child.displayObject.__omnicoreAcquireSource = 'child';
      return child.displayObject;
    }
    const pooled = this._takeDisplayObject(poolKey);
    if (pooled) return pooled;
    if (typeof child.toPixiObject === 'function') {
      const displayObject = this._normalizeDisplayObject(child.toPixiObject({ Container, Graphics, Text }), child);
      if (!displayObject) return null;
      displayObject.__omnicoreAcquireSource = 'new';
      child.displayObject = displayObject;
      child.sprite = displayObject;
      this.batchStatsDirty = true;
      return child.displayObject;
    }
    if (child.type === 'sprite') {
      const texture = typeof child.texture === 'string' ? this._resolveTexture(child.texture) : child.texture || Texture.EMPTY;
      if (typeof child.texture === 'string') this.sceneTextures.set(child.texture, texture);
      const sprite = this._takeSpriteDisplayObject() || new PixiSprite(texture);
      if (!sprite.__omnicoreAcquireSource) sprite.__omnicoreAcquireSource = 'new';
      sprite.texture = texture;
      this._syncPixiSprite(sprite, child);
      child.displayObject = sprite;
      child.sprite = sprite;
      this.batchStatsDirty = true;
      return sprite;
    }
    return null;
  }

  _syncDisplayObject(child, displayObject) {
    if (child.type === 'sprite') this._syncPixiSprite(displayObject, child);
    child.syncPixiObject?.(displayObject);
  }

  _syncPixiSprite(sprite, child) {
    if (!sprite) return;
    if (typeof child.texture === 'string' && sprite.texture !== undefined) {
      const texture = this._resolveTexture(child.texture);
      if (sprite.texture !== texture) {
        sprite.texture = texture;
        this.batchStatsDirty = true;
      }
      this.sceneTextures.set(child.texture, sprite.texture);
    }
    if (sprite.x !== child.x) sprite.x = child.x;
    if (sprite.y !== child.y) sprite.y = child.y;
    if (sprite.alpha !== child.alpha) sprite.alpha = child.alpha;
    if (sprite.rotation !== child.rotation) sprite.rotation = child.rotation;
    if (sprite.scale && (sprite.scale.x !== child.scaleX || sprite.scale.y !== child.scaleY)) {
      sprite.scale.set(child.scaleX, child.scaleY);
    }
  }

  _childKey(child) {
    const poolKey = this._poolKey(child);
    if (child.__omnicoreDisplayKey && child.__omnicorePoolKey === poolKey) {
      return child.__omnicoreDisplayKey;
    }
    if (!child.__omnicoreDisplayBase) {
      const base = child.id || child.name || child.key || this.nextDisplayId;
      this.nextDisplayId += 1;
      Object.defineProperty(child, '__omnicoreDisplayBase', {
        configurable: true,
        value: base
      });
    }

    if (child.__omnicorePoolKey && child.__omnicorePoolKey !== poolKey) {
      const previousDisplayObject = child.displayObject;
      child.displayObject = null;
      if (child.sprite === previousDisplayObject) child.sprite = null;
    }

    const nextKey = `${poolKey}:${child.__omnicoreDisplayBase}`;
    if (child.__omnicoreDisplayKey !== nextKey || child.__omnicorePoolKey !== poolKey) {
      Object.defineProperty(child, '__omnicoreDisplayKey', {
        configurable: true,
        value: nextKey
      });
      Object.defineProperty(child, '__omnicorePoolKey', {
        configurable: true,
        value: poolKey
      });
    }
    return child.__omnicoreDisplayKey;
  }

  _normalizeDisplayObject(displayObject, child) {
    if (!displayObject || typeof displayObject !== 'object') return null;
    if (
      typeof displayObject.emit === 'function'
      && typeof displayObject.on === 'function'
      && Array.isArray(displayObject.children)
    ) {
      return displayObject;
    }

    const fallback = new Container();
    fallback.visible = true;
    if (displayObject.id) fallback.id = displayObject.id;
    if (displayObject.name) fallback.name = displayObject.name;
    fallback.zIndex = child.zIndex || 0;
    return fallback;
  }

  _poolKey(child) {
    return child.poolKey || child.type || child.constructor?.name || 'display';
  }

  _renderLayerId(child, fallback) {
    return child?.id || child?.name || fallback;
  }

  _stageContains(displayObject) {
    if (!displayObject) return false;
    if (displayObject.parent === this.stage) return true;
    if (Array.isArray(this.stage.children)) return this.stage.children.includes(displayObject);
    return displayObject.parent === this.stage;
  }

  _releaseDisplayObject(poolKey, displayObject) {
    if (!displayObject || displayObject.destroyed) return;
    displayObject.visible = false;
    displayObject.__omnicoreAcquireSource = 'pool-idle';
    displayObject.__omnicorePoolKey = poolKey;
    displayObject.parent = null;
    if (displayObject.__omnicorePoolName === 'pixi-sprite-display-objects' && this.spritePool?.free(displayObject)) return;
    if (!this.displayPools.has(poolKey)) this.displayPools.set(poolKey, []);
    this.displayPools.get(poolKey).push(displayObject);
  }

  _takeSpriteDisplayObject() {
    if (!this.spritePool) return null;
    const sprite = this.spritePool.allocate();
    sprite.visible = true;
    sprite.__omnicoreAcquireSource = 'sprite-pool';
    return sprite;
  }

  _takeDisplayObject(poolKey) {
    const pool = this.displayPools.get(poolKey);
    while (pool?.length) {
      const displayObject = pool.pop();
      if (!displayObject?.destroyed) {
        displayObject.visible = true;
        displayObject.__omnicoreAcquireSource = 'display-pool';
        return displayObject;
      }
    }
    return null;
  }

  _applyStageOrder(children) {
    if (!Array.isArray(this.stage.children)) return;
    if (this.layerManager) {
      if (!this.layerManager.dirty) return;
      this.layerManager.sort();
      return;
    }
    const desired = [...children]
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      .map((child) => this.sceneDisplayObjects.get(this._childKey(child))?.displayObject)
      .filter(Boolean);
    if (this.autoZReorder && typeof this.stage.setChildIndex === 'function') {
      desired.forEach((displayObject, index) => {
        if (this.stage.children[index] !== displayObject) this.stage.setChildIndex(displayObject, index);
      });
      return;
    }
    this.stage.children.sort((a, b) => desired.indexOf(a) - desired.indexOf(b));
  }

  _resolveTexture(source) {
    if (!source) return Texture.EMPTY;
    if (this.textureCache.has(source)) return this.textureCache.get(source);
    let texture;
    if (!isConcreteTextureSource(source)) {
      texture = Texture.EMPTY;
    } else {
      try {
        texture = Texture.from(source);
      } catch {
        texture = Texture.EMPTY;
      }
    }
    this.textureCache.set(source, texture);
    return texture;
  }

  _updateBatchStats(children = []) {
    if (this.backend === 'canvas') return null;
    if (!this.batchStatsDirty && this.batchStats && this.lastBatchChildCount === children.length) return this.batchStats;
    this.batchStats = this.batchOptimizer.analyze(children, this.sceneDisplayObjects);
    this.batchStatsDirty = false;
    this.lastBatchChildCount = children.length;
    this.store?.set?.('renderer:drawCalls', this.batchStats.drawCalls);
    this.store?.set?.('renderer:batchStats', this.batchStats);
    return this.batchStats;
  }
}

function isConcreteTextureSource(source) {
  if (typeof source !== 'string') return true;
  if (/^(?:data:|blob:|https?:|\/|\.\/|\.\.\/)/iu.test(source)) return true;
  if (/\.(?:png|jpe?g|webp|gif|svg)(?:$|[?#])/iu.test(source)) return true;
  return false;
}

export default PixiRenderer;
