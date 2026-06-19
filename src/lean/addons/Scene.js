import { createOmniError } from '../../core/OmniError.js';

/**
 * Scene stack addon with node tree and visual transition hooks.
 */
export class SceneAddon {
  constructor() {
    this.stack = [];
    this.registry = new Map();
  }

  mount(bootstrap) {
    this.bootstrap = bootstrap;
    return this;
  }

  register(name, scene) {
    this.registry.set(name, scene);
    return scene;
  }

  async push(name, data) {
    const scene = await this._resolve(name, data);
    this.stack.push(scene);
    await scene.mount?.({ bootstrap: this.bootstrap, data, scene });
    return scene;
  }

  async pop() {
    const scene = this.stack.pop();
    await scene?.unmount?.({ bootstrap: this.bootstrap, scene });
    return scene;
  }

  async switch(name, data) {
    await this.transition('out');
    await this.pop();
    const scene = await this.push(name, data);
    await this.transition('in');
    return scene;
  }

  async transition(direction = 'in', duration = 120) {
    this.bootstrap?.store.set('scene:transition', { direction, duration, at: Date.now() });
    return new Promise((resolve) => setTimeout(resolve, duration));
  }

  current() {
    return this.stack[this.stack.length - 1] || null;
  }

  addChild(parent, child) {
    parent.children = parent.children || [];
    parent.children.push(child);
    child.parent = parent;
    return child;
  }

  getChild(parent, name) {
    return (parent.children || []).find((child) => child.name === name) || null;
  }

  removeChild(parent, child) {
    const children = parent.children || [];
    const index = children.indexOf(child);
    if (index >= 0) children.splice(index, 1);
    child.parent = null;
    return child;
  }

  async unmount() {
    while (this.stack.length) await this.pop();
    this.registry.clear();
  }

  async _resolve(name, data) {
    const entry = this.registry.get(name);
    if (!entry) throw createOmniError('Scene', `场景尚未注册：${name}`);
    return typeof entry === 'function' ? entry(data) : entry;
  }
}

export default SceneAddon;
