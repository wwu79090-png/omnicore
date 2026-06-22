import { createOmniError } from '../core/OmniError.js';

export class ComposerSceneFlow {
  constructor() {
    this.scenes = new Map();
    this.currentScene = null;
    this.overlay = null;
    this.entries = [];
  }

  register(name, lifecycle = {}) {
    this.scenes.set(String(name), {
      name: String(name),
      lifecycle,
      created: false
    });
    return this;
  }

  gotoScene(name, { params = {}, effect = null, time = 0 } = {}) {
    const entry = this._scene(name);
    if (!entry.created) {
      entry.lifecycle.create?.({ name: entry.name, params });
      entry.created = true;
    }
    entry.lifecycle.show?.({ name: entry.name, params, phase: 'will', effect, time, overlay: false });
    this.currentScene = entry;
    this.entries.push({ name: entry.name, effect, time });
    entry.lifecycle.show?.({ name: entry.name, params, phase: 'did', effect, time, overlay: false });
    return this.current();
  }

  showOverlay(name, params = {}) {
    const entry = this._scene(name);
    if (!entry.created) {
      entry.lifecycle.create?.({ name: entry.name, params });
      entry.created = true;
    }
    this.overlay = entry;
    entry.lifecycle.show?.({ name: entry.name, params, phase: 'did', overlay: true });
    return entry;
  }

  hideOverlay() {
    const entry = this.overlay;
    this.overlay = null;
    entry?.lifecycle.hide?.({ name: entry.name, phase: 'did', overlay: true });
    return entry || null;
  }

  removeScene(name) {
    const entry = this._scene(name);
    entry.lifecycle.destroy?.({ name: entry.name });
    entry.created = false;
    return this;
  }

  current() {
    return this.currentScene ? { name: this.currentScene.name } : null;
  }

  history() {
    return this.entries.map(clone);
  }

  _scene(name) {
    const entry = this.scenes.get(String(name));
    if (!entry) throw createOmniError('ComposerSceneFlow', `Scene is not registered: ${name}`);
    return entry;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default ComposerSceneFlow;
