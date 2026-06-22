import { createOmniError } from './OmniError.js';

export class CallbackGameLoop {
  constructor(callbacks = {}) {
    this.callbacks = { ...callbacks };
    this.state = {};
    this.booted = false;
    this.frameCount = 0;
  }

  boot(args = []) {
    if (this.booted) return this;
    this.booted = true;
    this.callbacks.load?.(this._context(), args);
    return this;
  }

  dispatch(name, ...args) {
    this._assertBooted();
    const callback = this.callbacks[String(name)];
    if (callback) callback(this._context(), ...args);
    return this;
  }

  frame(dt = 0) {
    this._assertBooted();
    this.callbacks.update?.(this._context(), dt);
    this.callbacks.draw?.(this._context());
    this.frameCount += 1;
    return this;
  }

  snapshot() {
    return {
      booted: this.booted,
      frame: this.frameCount,
      callbacks: Object.keys(this.callbacks).sort()
    };
  }

  _context() {
    return {
      loop: this,
      state: this.state,
      frame: this.frameCount
    };
  }

  _assertBooted() {
    if (!this.booted) throw createOmniError('CallbackGameLoop', 'Loop must be booted before frame or dispatch.');
  }
}

export default CallbackGameLoop;
