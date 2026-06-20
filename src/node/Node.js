import { createOmniError } from '../core/OmniError.js';

/**
 * Hierarchical runtime node used by prefabs and data-driven scenes.
 *
 * @example
 * const root = new Node({ name: 'Root' });
 * root.addChild(new Node({ name: 'Enemy' }));
 * root.getChild('Enemy');
 */
export class Node {
  constructor({
    name = 'node',
    type = 'node',
    x = 0,
    y = 0,
    zIndex = 0,
    visible = true,
    props = {},
    children = []
  } = {}) {
    this.type = type;
    this.name = name;
    this.x = x;
    this.y = y;
    this.zIndex = zIndex;
    this.visible = visible;
    this.props = { ...props };
    this.parent = null;
    this.children = [];
    this.__children = this.children;
    this.components = [];
    this.__components = this.components;
    this.__listeners = new Map();
    this.listeners = this.__listeners;
    children.forEach((child) => this.addChild(child instanceof Node ? child : Node.fromJSON(child)));
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
    for (const handler of this.__listeners.get(event) || []) {
      handler(...args);
    }
  }

  connect(event, target, targetEventOrHandler = event, options = {}) {
    if (!event) throw createOmniError('Node', 'connect 需要传入信号名称。');
    const handler = createSignalTargetHandler(target, targetEventOrHandler);
    let off = null;
    const wrapped = (...args) => {
      handler(...args);
      if (options.once) off?.();
    };
    off = this.on(event, wrapped);
    return off;
  }

  addChild(node) {
    if (!node) throw createOmniError('Node', 'addChild 需要传入有效子节点。');
    if (node.parent) node.parent.removeChild(node);
    node.parent = this;
    this.children.push(node);
    this.children.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    return node;
  }

  add(node) {
    return this.addChild(node);
  }

  getChild(nameOrPath) {
    if (!nameOrPath) return null;
    const parts = String(nameOrPath).split('/').filter(Boolean);
    let current = this;
    for (const part of parts) {
      current = current.children.find((child) => child.name === part) || null;
      if (!current) return null;
    }
    return current;
  }

  removeChild(childOrName) {
    const child = typeof childOrName === 'string' ? this.getChild(childOrName) : childOrName;
    const index = this.children.indexOf(child);
    if (index === -1) return null;
    const [removed] = this.children.splice(index, 1);
    removed.parent = null;
    return removed;
  }

  localToWorld(point = {}) {
    return worldPointFor(this, point);
  }

  worldToLocal(point = {}) {
    return localPointFor(this, point);
  }

  toLocalPosition(point = {}) {
    return this.worldToLocal(point);
  }

  getWorldPosition() {
    return this.localToWorld({ x: 0, y: 0 });
  }

  clearListeners() {
    for (const handlers of this.__listeners.values()) {
      handlers.clear();
    }
    this.__listeners.clear();
  }

  destroyComponents() {
    for (const component of [...this.__components]) {
      if (component.destroy && component.destroy !== component.onDestroy) component.destroy?.();
      component.onDestroy?.();
    }
    this.__components.length = 0;
  }

  traverse(visitor) {
    visitor(this);
    for (const child of this.children) child.traverse?.(visitor);
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

  update(delta, time) {
    for (const component of this.components) component.update?.(delta, time);
    for (const child of this.children) child.update?.(delta, time);
  }

  destroy() {
    this.clearListeners();
    this.destroyComponents();
    for (const child of [...this.__children]) child.destroy?.();
    this.__children.length = 0;
    this.children.length = 0;
    this.__components.length = 0;
    this.parent = null;
  }

  toJSON() {
    return {
      type: this.type,
      name: this.name,
      x: this.x,
      y: this.y,
      zIndex: this.zIndex,
      visible: this.visible,
      props: { ...this.props },
      children: this.children.map((child) => child.toJSON?.() || child)
    };
  }

  static fromJSON(json = {}) {
    return new Node(json);
  }
}

function createSignalTargetHandler(target, targetEventOrHandler) {
  if (typeof target === 'function') return target;
  if (typeof targetEventOrHandler === 'function') {
    return (...args) => targetEventOrHandler.call(target, ...args);
  }
  const targetName = String(targetEventOrHandler || '');
  if (!target || !targetName) {
    throw createOmniError('Node', 'connect 需要有效目标或处理函数。');
  }
  if (typeof target[targetName] === 'function') {
    return (...args) => target[targetName](...args);
  }
  if (typeof target.emit === 'function') {
    return (...args) => target.emit(targetName, ...args);
  }
  throw createOmniError('Node', `connect 目标缺少处理函数或 emit：${targetName}。`);
}

function worldPointFor(node, point = {}) {
  const chain = [];
  let current = node;
  while (current) {
    chain.unshift(current);
    current = current.parent || null;
  }
  return roundPoint(chain.reduce((acc, item) => transformPoint(acc, item), {
    x: Number(point.x || 0),
    y: Number(point.y || 0)
  }));
}

function localPointFor(node, point = {}) {
  const chain = [];
  let current = node;
  while (current) {
    chain.push(current);
    current = current.parent || null;
  }
  return roundPoint(chain.reduce((acc, item) => inverseTransformPoint(acc, item), {
    x: Number(point.x || 0),
    y: Number(point.y || 0)
  }));
}

function transformPoint(point, node) {
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

function inverseTransformPoint(point, node) {
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

function roundPoint(point) {
  return {
    x: roundNumber(point.x),
    y: roundNumber(point.y)
  };
}

function roundNumber(value) {
  return Number(Number(value).toFixed(6));
}

export default Node;
