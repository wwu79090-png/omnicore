/**
 * Scene and Sprite primitives.
 *
 * Scene mirrors Phaser's small lifecycle surface while keeping plugins explicit.
 * Sprite supports Cocos-style `addComponent()` without bringing an editor runtime.
 *
 * @example
 * const scene = new Scene('play');
 * const hero = scene.add(new Sprite('hero.png'));
 * hero.addComponent(class Health { constructor(owner) { this.owner = owner; } });
 */
import { Assert } from '../debug/Assert.js';
import { createOmniError } from '../core/OmniError.js';
import ResourceOwnershipGraph from '../assets/ResourceOwnershipGraph.js';
import SceneLifecycle from './SceneLifecycle.js';
import Animation from '../animation/Animation.js';
import Transform2D from '../graphics/Transform2D.js';
import Timer from '../timer/Timer.js';

class ComponentHost {
  constructor() {
    this.components = [];
    this.__components = this.components;
    this.__listeners = new Map();
    this.listeners = this.__listeners;
  }

  on(event, handler) {
    if (!this.__listeners.has(event)) this.__listeners.set(event, new Set());
    this.__listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.__listeners.get(event);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) this.__listeners.delete(event);
  }

  emit(event, ...args) {
    for (const handler of this.__listeners.get(event) || []) handler(...args);
  }

  clearListeners() {
    for (const handlers of this.__listeners.values()) {
      handlers.clear();
    }
    this.__listeners.clear();
  }

  addComponent(Component, options = {}) {
    const component = typeof Component === 'function' ? new Component(this, options) : Component;
    component.owner = component.owner || this;
    component.node = component.node || this;
    this.components.push(component);
    component.onAdd?.(this, options);
    component.onLoad?.();
    return component;
  }

  getComponent(Component) {
    return this.components.find((component) => component instanceof Component || component.type === Component);
  }

  removeComponent(component) {
    const index = this.components.indexOf(component);
    if (index >= 0) {
      component.onRemove?.();
      this.components.splice(index, 1);
    }
  }

  updateComponents(delta, time) {
    for (const component of this.components) component.update?.(delta, time);
  }

  destroyComponents() {
    for (const component of [...this.__components]) {
      if (component.destroy && component.destroy !== component.onDestroy) component.destroy?.();
      component.onDestroy?.();
    }
    this.__components.length = 0;
    this.clearListeners();
  }
}

export class Sprite extends ComponentHost {
  constructor(texture, options = {}) {
    super();
    this.type = 'sprite';
    this.texture = texture;
    this.sprite = this;
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.width = options.width ?? 32;
    this.height = options.height ?? 32;
    this.alpha = options.alpha ?? 1;
    this.color = options.color ?? null;
    this.tint = options.tint ?? null;
    this.label = options.label ?? true;
    const scale = typeof options.scale === 'number' ? options.scale : null;
    this.scaleX = options.scale?.x ?? options.scaleX ?? scale ?? 1;
    this.scaleY = options.scale?.y ?? options.scaleY ?? scale ?? 1;
    this.rotation = options.rotation ?? 0;
    this.anchor = options.anchor ?? { x: 0, y: 0 };
    this.billboard = Boolean(options.billboard);
    this.omnicoreBillboard = this.billboard;
    this.visible = options.visible ?? true;
    this.zIndex = options.zIndex ?? 0;
    this.displayObject = null;
    this.animations = [];
    this.animationController = null;
    this.transform = Transform2D.create(this, options.transform || {});
    this.scale = this.transform.scale;
    this.sliceConfig = options.slice || null;
    this.mask = options.mask || null;
    this.crop = options.crop || null;
    this.atlas = options.atlas || (options.frames ? { texture, frames: options.frames } : null);
    this.frameName = null;
    this.frame = null;
    this.sourceFrame = null;
    this.__children = [];
    if (options.frame || options.frameName) this.setFrame(options.frame || options.frameName);
  }

  setOrigin(x = 0, y = x) {
    this.anchor = {
      x: Number.isFinite(Number(x)) ? Number(x) : 0,
      y: Number.isFinite(Number(y)) ? Number(y) : 0
    };
    return this;
  }

  getOrigin() {
    return {
      x: Number(this.anchor?.x || 0),
      y: Number(this.anchor?.y || 0)
    };
  }

  faceCamera(camera = {}) {
    if (!this.billboard) return this;
    this.rotation = -Number(camera.rotation || camera.rotationZ || 0);
    this.omnicoreBillboardFacing = {
      cameraRotation: Number(camera.rotation || camera.rotationZ || 0),
      appliedRotation: this.rotation
    };
    return this;
  }

  add(child) {
    child.parent = this;
    this.__children.push(child);
    this.__children.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    return child;
  }

  addChild(child) {
    return this.add(child);
  }

  remove(child) {
    const index = this.__children.indexOf(child);
    if (index >= 0) this.__children.splice(index, 1);
    if (child?.parent === this) child.parent = null;
    return child;
  }

  removeChild(child) {
    return this.remove(child);
  }

  get children() {
    return this.__children;
  }

  slice(top, bottom, left, right) {
    if (arguments.length === 0) return this.sliceConfig ? { ...this.sliceConfig } : null;
    this.sliceConfig = {
      top: Math.max(0, Number(top) || 0),
      bottom: Math.max(0, Number(bottom) || 0),
      left: Math.max(0, Number(left) || 0),
      right: Math.max(0, Number(right) || 0)
    };
    return this;
  }

  setMask(mask = null) {
    this.mask = mask;
    return this;
  }

  setCrop(x = 0, y = 0, width = this.width, height = this.height) {
    if (x == null || x === false) {
      this.crop = null;
      return this;
    }
    if (typeof x === 'object') {
      this.crop = normalizeCrop(x, this.width, this.height);
      return this;
    }
    this.crop = normalizeCrop({ x, y, width, height }, this.width, this.height);
    return this;
  }

  setTint(color) {
    this.tint = color;
    return this;
  }

  clearTint() {
    this.tint = null;
    return this;
  }

  setFrame(name) {
    const frame = resolveAtlasFrame(this.atlas, name);
    if (!frame) throw createOmniError('Sprite', `图集帧不存在：${String(name)}`);
    const source = normalizeAtlasFrameSource(frame);
    this.frameName = String(name);
    this.frame = frame;
    this.sourceFrame = source;
    this.texture = frame.texture || frame.image || this.atlas?.texture || this.atlas?.image || this.texture;
    if (source.width > 0) this.width = source.width;
    if (source.height > 0) this.height = source.height;
    return this;
  }

  localToWorld(point = {}) {
    return displayObjectWorldPoint(this, point);
  }

  worldToLocal(point = {}) {
    return displayObjectLocalPoint(this, point);
  }

  getWorldPosition() {
    return this.localToWorld({ x: 0, y: 0 });
  }

  bounds() {
    const scale = this.transform?.scale || { x: this.scaleX, y: this.scaleY };
    return {
      x: this.x,
      y: this.y,
      width: Math.abs(this.width * (scale.x ?? 1)),
      height: Math.abs(this.height * (scale.y ?? 1))
    };
  }

  renderChildren(ctx) {
    for (const child of [...this.__children].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))) {
      child.render?.(ctx);
    }
  }

  addAnimation(animation) {
    this.animations.push(animation);
    if (animation?.sprite === this && !this.animationController) this.animationController = animation;
    return animation;
  }

  setAnimations(spriteSheet, options = {}) {
    const animation = spriteSheet instanceof Animation
      ? spriteSheet
      : new Animation(this, spriteSheet, options);
    this.animationController = animation;
    if (!this.animations.includes(animation)) this.addAnimation(animation);
    return this;
  }

  play(name = 'default', spriteSheet = null, options = {}) {
    if (spriteSheet) this.setAnimations(spriteSheet, options);
    const animation = this.animationController || this.animations.find((item) => item?.sprite === this && item?.play);
    if (!animation) {
      this.emit('animation:missing', { name, sprite: this });
      return this;
    }
    animation.play(name);
    return this;
  }

  stopAnimation() {
    this.animationController?.stop?.();
    return this;
  }

  update(delta, time) {
    this.updateComponents(delta, time);
    for (const animation of this.animations) animation.update(delta);
  }

  render(ctx) {
    if (!this.visible || !ctx) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    Transform2D.applyToContext(ctx, this);
    applySpriteMask(ctx, this.mask);
    const drawX = this.anchor.x ? -this.anchor.x * this.width : 0;
    const drawY = this.anchor.y ? -this.anchor.y * this.height : 0;
    if (isDrawableTexture(this.texture)) {
      if (this.crop) drawCroppedTexture(ctx, this.texture, this.crop, drawX, drawY, this.width, this.height);
      else if (this.sliceConfig) drawSlicedTexture(ctx, this.texture, drawX, drawY, this.width, this.height, this.sliceConfig);
      else if (this.sourceFrame) {
        ctx.drawImage(
          this.texture,
          this.sourceFrame.x,
          this.sourceFrame.y,
          this.sourceFrame.width,
          this.sourceFrame.height,
          drawX,
          drawY,
          this.width,
          this.height
        );
      } else ctx.drawImage(this.texture, drawX, drawY, this.width, this.height);
    } else {
      ctx.fillStyle = this.tint || this.color || '#38bdf8';
      ctx.fillRect(drawX, drawY, this.width, this.height);
      if (this.label !== false) {
        ctx.fillStyle = '#0f172a';
        ctx.font = '10px sans-serif';
        ctx.fillText(String(this.texture ?? 'sprite'), drawX + 4, drawY + 16);
      }
    }
    this.renderChildren(ctx);
    ctx.restore();
  }

  destroy() {
    this.clearListeners();
    this.destroyComponents();
    for (const animation of this.animations) animation.stop?.();
    this.animations.length = 0;
    this.displayObject?.destroy?.({ children: true, texture: false, textureSource: false });
    this.displayObject = null;
  }
}

function resolveAtlasFrame(atlas, name) {
  if (!atlas || name == null) return null;
  const frames = atlas.frames || atlas;
  return frames?.[name] || frames?.[String(name)] || null;
}

function normalizeAtlasFrameSource(frame = {}) {
  const source = frame.frame || frame.source || frame;
  return {
    x: Number(source.x ?? source.left ?? 0),
    y: Number(source.y ?? source.top ?? 0),
    width: Number(source.w ?? source.width ?? frame.w ?? frame.width ?? 0),
    height: Number(source.h ?? source.height ?? frame.h ?? frame.height ?? 0)
  };
}

function normalizeCrop(crop = {}, fallbackWidth = 0, fallbackHeight = 0) {
  return {
    x: Math.max(0, Number(crop.x ?? crop.left ?? 0)),
    y: Math.max(0, Number(crop.y ?? crop.top ?? 0)),
    width: Math.max(0, Number(crop.width ?? crop.w ?? fallbackWidth)),
    height: Math.max(0, Number(crop.height ?? crop.h ?? fallbackHeight))
  };
}

function applySpriteMask(ctx, mask) {
  if (!mask) return;
  ctx.beginPath?.();
  if (typeof mask.path === 'function') {
    mask.path(ctx);
  } else {
    ctx.rect?.(
      Number(mask.x || 0),
      Number(mask.y || 0),
      Number(mask.width ?? mask.w ?? 0),
      Number(mask.height ?? mask.h ?? 0)
    );
  }
  ctx.clip?.();
}

function drawCroppedTexture(ctx, texture, crop, x, y, width, height) {
  ctx.drawImage(
    texture,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    x,
    y,
    width,
    height
  );
}

function displayObjectWorldPoint(node, point = {}) {
  const chain = [];
  let current = node;
  while (current) {
    chain.unshift(current);
    current = current.parent || null;
  }
  return roundDisplayPoint(chain.reduce((acc, item) => transformDisplayPoint(acc, item), {
    x: Number(point.x || 0),
    y: Number(point.y || 0)
  }));
}

function displayObjectLocalPoint(node, point = {}) {
  const chain = [];
  let current = node;
  while (current) {
    chain.push(current);
    current = current.parent || null;
  }
  return roundDisplayPoint(chain.reduce((acc, item) => inverseTransformDisplayPoint(acc, item), {
    x: Number(point.x || 0),
    y: Number(point.y || 0)
  }));
}

function transformDisplayPoint(point, node) {
  const scale = Number(node.scale ?? 1);
  const scaleX = Number(node.scaleX ?? scale);
  const scaleY = Number(node.scaleY ?? scale);
  const rotation = Number(node.rotation || 0);
  const scaled = {
    x: point.x * scaleX,
    y: point.y * scaleY
  };
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: Number(node.x || 0) + scaled.x * cos - scaled.y * sin,
    y: Number(node.y || 0) + scaled.x * sin + scaled.y * cos
  };
}

function inverseTransformDisplayPoint(point, node) {
  const scale = Number(node.scale ?? 1);
  const scaleX = Number(node.scaleX ?? scale) || 1;
  const scaleY = Number(node.scaleY ?? scale) || 1;
  const rotation = -Number(node.rotation || 0);
  const translated = {
    x: point.x - Number(node.x || 0),
    y: point.y - Number(node.y || 0)
  };
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: (translated.x * cos - translated.y * sin) / scaleX,
    y: (translated.x * sin + translated.y * cos) / scaleY
  };
}

function roundDisplayPoint(point) {
  return {
    x: Number(point.x.toFixed(6)),
    y: Number(point.y.toFixed(6))
  };
}

function isDrawableTexture(texture) {
  if (!texture) return false;
  const imageCtor = globalThis.HTMLImageElement;
  const canvasCtor = globalThis.HTMLCanvasElement;
  if (imageCtor && texture instanceof imageCtor) return true;
  if (canvasCtor && texture instanceof canvasCtor) return true;
  return typeof texture === 'object' && Number(texture.width) > 0 && Number(texture.height) > 0;
}

function drawSlicedTexture(ctx, texture, x, y, width, height, slice) {
  const sourceWidth = Number(texture.width || width);
  const sourceHeight = Number(texture.height || height);
  const left = Math.min(slice.left, sourceWidth);
  const right = Math.min(slice.right, sourceWidth - left);
  const top = Math.min(slice.top, sourceHeight);
  const bottom = Math.min(slice.bottom, sourceHeight - top);
  const columns = [
    [0, left, x, left],
    [left, sourceWidth - left - right, x + left, Math.max(0, width - left - right)],
    [sourceWidth - right, right, x + width - right, right]
  ];
  const rows = [
    [0, top, y, top],
    [top, sourceHeight - top - bottom, y + top, Math.max(0, height - top - bottom)],
    [sourceHeight - bottom, bottom, y + height - bottom, bottom]
  ];
  for (const [sourceX, sourceCellWidth, destX, destCellWidth] of columns) {
    for (const [sourceY, sourceCellHeight, destY, destCellHeight] of rows) {
      if (sourceCellWidth <= 0 || sourceCellHeight <= 0 || destCellWidth <= 0 || destCellHeight <= 0) continue;
      ctx.drawImage(texture, sourceX, sourceY, sourceCellWidth, sourceCellHeight, destX, destY, destCellWidth, destCellHeight);
    }
  }
}

export class Scene extends ComponentHost {
  constructor(name, options = {}) {
    super();
    this.name = name;
    this.children = [];
    this.__children = this.children;
    this.resources = new Set();
    this.debug = false;
    this.created = false;
    this.active = true;
    this.paused = false;
    this.visible = true;
    this.options = options;
    this.game = null;
    this.input = null;
    this.camera = null;
    this.__timerTasks = new Set();
    this.__localTimer = new Timer();
    this.timer = createSceneTimerProxy(this.__localTimer, this.__timerTasks);
    this.__entered = false;
    this.lifecycle = new SceneLifecycle({ name, owner: this });
    this.lifecycleState = this.lifecycle.state;
    this.lifecycleSignal = this.lifecycle.signal;
    this.resourceGraph = new ResourceOwnershipGraph({
      warn: (message) => this.game?.logger?.warn?.('Scene', message) || console.warn?.(message)
    });
  }

  bindTimer(timer) {
    this.__baseTimer = timer || null;
    if (!this.__localTimer) this.__localTimer = new Timer();
    if (!this.timer) this.timer = createSceneTimerProxy(this.__localTimer, this.__timerTasks);
    return this.timer;
  }

  clearTimers() {
    for (const task of this.__timerTasks) task.clear?.();
    this.__timerTasks.clear();
    this.__localTimer?.clear?.();
  }

  add(child) {
    this.lifecycle.assertAlive();
    this._assertEntityLifeCycle(child);
    child.parent = this;
    this.children.push(child);
    this.children.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    return child;
  }

  remove(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
  }

  init() {}

  preload() {}

  create() {}

  enter(data = undefined) {
    this._transitionLifecycle('enter', { data });
    this.active = true;
    if (this.__entered) return this;
    this.__entered = true;
    this.onEnter?.(data, this);
    this.emit('enter', { scene: this, data });
    return this;
  }

  update(delta, time) {
    if (this.lifecycle.destroyed) return this;
    if (this.paused || !this.active) return this;
    this.__localTimer?.update?.(delta);
    this.onUpdate?.(delta, time, this);
    this.updateComponents(delta, time);
    const culling = this.game?.culling;
    const sleepWake = this.game?.sleepWake;
    culling?.syncFromGame?.(this.game);
    for (const child of this.children) {
      if (child.__omnicoreSkipUpdate) continue;
      const shouldUpdate = culling?.shouldUpdate ? culling.shouldUpdate(child) : true;
      child.__omnicoreCulled = !shouldUpdate;
      culling?.trackLogicActivity?.(child, { willUpdate: shouldUpdate, scene: this, delta, time });
      if (child.__omnicoreCulled) continue;
      if (sleepWake?.shouldUpdate && !sleepWake.shouldUpdate(child, this)) continue;
      if (culling?.visibleTileChunks && child.layers && child.tileWidth) {
        child.__omnicoreVisibleChunks = culling.visibleTileChunks(child, child.chunkSize || 16);
      }
      this._assertEntityLifeCycle(child);
      child.update?.(delta, time);
    }
    return this;
  }

  pause() {
    this._transitionLifecycle('pause');
    this.paused = true;
    this.active = false;
    this.emit('pause', { scene: this });
    return this;
  }

  resume() {
    this._transitionLifecycle('resume');
    this.paused = false;
    this.active = true;
    this.emit('resume', { scene: this });
    return this;
  }

  render(alpha = 0, time = 0) {
    if (this.lifecycle.destroyed) return this;
    this.onRender?.(alpha, time, this);
    this.emit('render', { scene: this, alpha, time });
    for (const child of this.children) child.onRender?.(alpha, time, this);
    return this;
  }

  exit(data = undefined) {
    this._transitionLifecycle('leave', { data });
    if (!this.__entered) {
      this.active = false;
      this.clearTimers();
      return this;
    }
    this.__entered = false;
    this.onExit?.(data, this);
    this.emit('exit', { scene: this, data });
    this.clearTimers();
    this.active = false;
    return this;
  }

  apply25DSort({ shadowCorrection = false, baseZIndex = 0 } = {}) {
    this.children.forEach((child, index) => {
      const footY = Number(child.y || 0) + Number(child.height || child.bounds?.height || 0);
      const depthBand = child.omnicoreDepthBand?.zIndex || child.depthBand?.zIndex || 0;
      child.zIndex = Number(baseZIndex) + depthBand + footY;
      child.omnicore25DSortKey = child.zIndex;
      child.omnicore25DOrder = index;
      if (shadowCorrection && child.shadow) {
        child.omnicoreFakeShadow = {
          type: child.shadow.type || 'ellipse',
          x: Number(child.x || 0),
          y: Number(child.y || 0),
          radiusX: Number(child.shadow.radiusX || child.width || child.bounds?.width || 24),
          radiusY: Number(child.shadow.radiusY || 12),
          opacity: Math.max(0, Math.min(1, Number(child.shadow.opacity ?? 0.28)))
        };
      }
    });
    this.children.sort((left, right) => {
      const depthDelta = Number(left.zIndex || 0) - Number(right.zIndex || 0);
      if (depthDelta !== 0) return depthDelta;
      return Number(left.omnicore25DOrder || 0) - Number(right.omnicore25DOrder || 0);
    });
    return this.children;
  }

  _assertEntityLifeCycle(entity) {
    if (!this.debug) return;
    Assert.isDefined(entity, 'entity');
    Assert.isDefined(entity?.sprite, 'entity.sprite');
    Assert.isNumber(entity?.x, 'entity.x');
    Assert.isNumber(entity?.y, 'entity.y');
  }

  logHierarchy({ logger = console.log } = {}) {
    const lines = [`Scene(${this.name})`];
    const visit = (node, depth) => {
      const label = node?.id || node?.name || node?.type || node?.constructor?.name || 'node';
      lines.push(`${'  '.repeat(depth)}- ${label}`);
      for (const child of node?.children || []) visit(child, depth + 1);
    };
    for (const child of this.children) visit(child, 1);
    const output = lines.join('\n');
    logger?.(output);
    return output;
  }

  destroy() {
    if (this.lifecycle.destroyed) return this;
    this.unmount();
    this.destroyComponents();
    for (const child of [...this.__children]) child.destroy?.();
    const trackedResources = new Set(
      [...(this.resourceGraph.ownerRecords.get(this) || [])].map((record) => record.resource)
    );
    this.resourceGraph.releaseOwner(this);
    for (const resource of this.resources) {
      if (!trackedResources.has(resource)) {
        resource.destroy?.(true);
        resource.dispose?.();
      }
    }
    this.children.length = 0;
    this.resources.clear();
    this.active = false;
    this._transitionLifecycle('destroyed');
    return this;
  }

  unmount() {
    this.exit();
  }

  trackResource(resource, options = {}) {
    this.lifecycle.assertAlive();
    this.resources.add(resource);
    this.resourceGraph.track(this, resource, options);
    return resource;
  }

  releaseResource(resource) {
    this.resources.delete(resource);
    return this.resourceGraph.release(resource, { force: true });
  }

  getResourceReport() {
    const leaks = this.lifecycle.destroyed
      ? this.resourceGraph.assertNoLeaks(this).leaks
      : [];
    return {
      resources: this.resourceGraph.snapshot(this),
      leaks
    };
  }

  guardCallback(callback, options = {}) {
    return this.lifecycle.guard(callback, options);
  }

  _transitionLifecycle(state, detail = {}) {
    const record = this.lifecycle.transition(state, detail);
    this.lifecycleState = this.lifecycle.state;
    this.lifecycleSignal = this.lifecycle.signal;
    this.game?.events?.emit?.(`scene:${state}`, { scene: this, detail, lifecycle: this.lifecycle.snapshot() });
    return record;
  }
}

function createSceneTimerProxy(timer, sceneTasks) {
  const track = (task) => {
    if (task?.clear) {
      sceneTasks.add(task);
      const originalClear = task.clear.bind(task);
      task.clear = () => {
        sceneTasks.delete(task);
        return originalClear();
      };
      task.cancel = task.clear;
      task.dispose = task.clear;
    }
    return task;
  };

  return {
    delay: (ms, callback) => track(timer.delay(ms, callback)),
    interval: (ms, callback) => track(timer.interval(ms, callback)),
    after: (ms, callback) => track(timer.after(ms, callback)),
    every: (ms, callback) => track(timer.every(ms, callback)),
    clear: () => {
      for (const task of [...sceneTasks]) task.clear?.();
      sceneTasks.clear();
    },
    update: (...args) => timer.update?.(...args),
    base: timer
  };
}

export default Scene;
