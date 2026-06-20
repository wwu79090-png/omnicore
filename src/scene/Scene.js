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
import Animation from '../animation/Animation.js';
import Transform2D from '../graphics/Transform2D.js';

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
    this.label = options.label ?? true;
    this.scaleX = options.scaleX ?? 1;
    this.scaleY = options.scaleY ?? 1;
    this.rotation = options.rotation ?? 0;
    this.anchor = options.anchor ?? { x: 0, y: 0 };
    this.visible = options.visible ?? true;
    this.zIndex = options.zIndex ?? 0;
    this.displayObject = null;
    this.animations = [];
    this.animationController = null;
    this.transform = Transform2D.create(this, options.transform || {});
    this.sliceConfig = options.slice || null;
    this.__children = [];
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

  add(child) {
    child.parent = this;
    this.__children.push(child);
    this.__children.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    return child;
  }

  remove(child) {
    const index = this.__children.indexOf(child);
    if (index >= 0) this.__children.splice(index, 1);
    if (child?.parent === this) child.parent = null;
    return child;
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
    const drawX = -this.anchor.x * this.width;
    const drawY = -this.anchor.y * this.height;
    if (isDrawableTexture(this.texture)) {
      if (this.sliceConfig) drawSlicedTexture(ctx, this.texture, drawX, drawY, this.width, this.height, this.sliceConfig);
      else ctx.drawImage(this.texture, drawX, drawY, this.width, this.height);
    } else {
      ctx.fillStyle = this.color || '#38bdf8';
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
    this.visible = true;
    this.options = options;
    this.game = null;
    this.input = null;
    this.camera = null;
    this.timer = null;
    this.__timerTasks = new Set();
  }

  bindTimer(timer) {
    this.clearTimers();
    this.__baseTimer = timer || null;
    this.timer = timer ? createSceneTimerProxy(timer, this.__timerTasks) : null;
    return this.timer;
  }

  clearTimers() {
    for (const task of this.__timerTasks) task.clear?.();
    this.__timerTasks.clear();
  }

  add(child) {
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

  update(delta, time) {
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

  destroy() {
    this.unmount();
    this.destroyComponents();
    for (const child of [...this.__children]) child.destroy?.();
    for (const resource of this.resources) resource.destroy?.();
    this.children.length = 0;
    this.resources.clear();
    this.active = false;
  }

  unmount() {
    this.clearTimers();
    this.active = false;
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
