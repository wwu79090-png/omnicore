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
    this.__children = [];
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
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scaleX, this.scaleY);
    const drawX = -this.anchor.x * this.width;
    const drawY = -this.anchor.y * this.height;
    if (this.texture instanceof HTMLImageElement || this.texture instanceof HTMLCanvasElement) {
      ctx.drawImage(this.texture, drawX, drawY, this.width, this.height);
    } else {
      ctx.fillStyle = this.color || '#38bdf8';
      ctx.fillRect(drawX, drawY, this.width, this.height);
      if (this.label !== false) {
        ctx.fillStyle = '#0f172a';
        ctx.font = '10px sans-serif';
        ctx.fillText(String(this.texture ?? 'sprite'), drawX + 4, drawY + 16);
      }
    }
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
    this.destroyComponents();
    for (const child of [...this.__children]) child.destroy?.();
    for (const resource of this.resources) resource.destroy?.();
    this.children.length = 0;
    this.resources.clear();
    this.active = false;
  }
}

export default Scene;
