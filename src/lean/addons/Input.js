/**
 * Native input addon based on EventTarget and AbortController.
 */
export class InputAddon {
  constructor({ target = null, preventDefault = true } = {}) {
    this.target = target;
    this.preventDefault = preventDefault;
    this.events = new EventTarget();
    this.abort = null;
    this.window = null;
    this.keys = new Set();
    this.pointer = { x: 0, y: 0, down: false };
    this.actions = new Map();
  }

  mount(bootstrap, options = {}) {
    this.target = options.target || this.target || bootstrap.document?.body || null;
    this.window = options.window || bootstrap.window || globalThis.window || null;
    this.abort = new AbortController();
    const { signal } = this.abort;
    this.window?.addEventListener?.('keydown', (event) => {
      this.keys.add(event.code || event.key);
      this._emitAction(event.code || event.key, true);
    }, { signal });
    this.window?.addEventListener?.('keyup', (event) => {
      this.keys.delete(event.code || event.key);
      this._emitAction(event.code || event.key, false);
    }, { signal });
    ['pointerdown', 'pointermove', 'pointerup'].forEach((type) => {
      this.target?.addEventListener?.(type, (event) => this._pointer(type, event), { signal, passive: false });
    });
    return this;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  mapAction(name, codes = []) {
    this.actions.set(name, new Set(codes));
    return this;
  }

  on(type, handler) {
    this.events.addEventListener(type, handler);
    return () => this.events.removeEventListener(type, handler);
  }

  gamepads() {
    return [...(this.window?.navigator?.getGamepads?.() || globalThis.navigator?.getGamepads?.() || [])].filter(Boolean);
  }

  unmount() {
    this.abort?.abort?.();
    this.abort = null;
    this.window = null;
    this.keys.clear();
  }

  _pointer(type, event) {
    if (this.preventDefault && event.cancelable) event.preventDefault();
    const rect = this.target?.getBoundingClientRect?.() || { left: 0, top: 0 };
    this.pointer = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      down: type !== 'pointerup'
    };
    this.events.dispatchEvent(createDetailEvent(type, this.pointer));
  }

  _emitAction(code, down) {
    for (const [name, codes] of this.actions) {
      if (codes.has(code)) this.events.dispatchEvent(createDetailEvent('action', { name, down, code }));
    }
  }
}

function createDetailEvent(type, detail) {
  if (typeof CustomEvent === 'function') return new CustomEvent(type, { detail });
  const event = new Event(type);
  event.detail = detail;
  return event;
}

export default InputAddon;
