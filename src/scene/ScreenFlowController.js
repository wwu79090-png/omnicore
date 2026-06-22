import { createOmniError } from '../core/OmniError.js';

export class ScreenFlowController {
  constructor() {
    this.screens = new Map();
    this.currentId = null;
    this.viewport = null;
  }

  setScreen(id, screen) {
    const key = String(id);
    if (!screen) throw createOmniError('ScreenFlowController', `Screen is required: ${key}`);
    if (this.currentId && this.currentId !== key) this.screens.get(this.currentId)?.hide?.();
    this.screens.set(key, screen);
    this.currentId = key;
    screen.show?.();
    if (this.viewport) screen.resize?.(this.viewport.width, this.viewport.height);
    return this;
  }

  resize(width, height) {
    this.viewport = { width: Number(width), height: Number(height) };
    this._current()?.resize?.(this.viewport.width, this.viewport.height);
    return this;
  }

  render(dt = 0) {
    this._current()?.render?.(dt);
    return this;
  }

  pause() {
    this._current()?.pause?.();
    return this;
  }

  resume() {
    this._current()?.resume?.();
    return this;
  }

  dispose(id = null) {
    if (id == null) {
      for (const key of [...this.screens.keys()]) this.dispose(key);
      return this;
    }
    const key = String(id);
    const screen = this.screens.get(key);
    if (!screen) return this;
    if (this.currentId === key) {
      screen.hide?.();
      this.currentId = null;
    }
    screen.dispose?.();
    this.screens.delete(key);
    return this;
  }

  snapshot() {
    return {
      current: this.currentId,
      viewport: this.viewport ? { ...this.viewport } : null,
      screens: [...this.screens.keys()].sort()
    };
  }

  _current() {
    if (!this.currentId) return null;
    const screen = this.screens.get(this.currentId);
    if (!screen) throw createOmniError('ScreenFlowController', `Current screen is not registered: ${this.currentId}`);
    return screen;
  }
}

export default ScreenFlowController;
