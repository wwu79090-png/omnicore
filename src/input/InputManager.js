import EventBus from '../core/EventBus.js';
import { createOmniError } from '../core/OmniError.js';

/**
 * Keyboard and pointer input manager.
 *
 * Input is intentionally small and lifecycle-bound to `Game`. Scenes receive
 * `scene.input` automatically, and `SceneManager.update()` refreshes it before
 * calling the active scene update.
 *
 * @example
 * const input = new InputManager({ target: game.core.canvas });
 * input.pointer.on('click', ({ x, y }) => console.log(x, y));
 * if (input.keyboard.isDown('Space')) player.jump();
 */
class KeyboardState {
  constructor() {
    this.keys = new Set();
  }

  isDown(code) {
    return this.keys.has(code);
  }

  press(code) {
    this.keys.add(code);
  }

  release(code) {
    this.keys.delete(code);
  }

  clear() {
    this.keys.clear();
  }
}

class PointerState {
  constructor() {
    this.events = new EventBus();
    this.position = { x: 0, y: 0 };
    this.down = false;
  }

  on(event, handler) {
    return this.events.on(event, handler);
  }

  emit(event, payload) {
    this.events.emit(event, payload);
  }

  clear() {
    this.events.clear();
    this.position = { x: 0, y: 0 };
    this.down = false;
  }
}

export class InputManager {
  constructor({ target = null, preventDefault = true, resolution = null, events = null } = {}) {
    this.target = target;
    this.preventDefault = preventDefault;
    this.resolutionOverride = resolution;
    this.resolution = resolution || 1;
    this.events = events || new EventBus();
    this.keyboard = new KeyboardState();
    this.pointer = new PointerState();
    this.actionBindings = new Map();
    this.comboActions = new Map();
    this.listeners = [];
    this.enabled = true;
    this.bind(target);
  }

  bind(targetOrAction, keys = undefined) {
    if (typeof targetOrAction === 'string' && keys !== undefined) {
      return this.bindAction(targetOrAction, keys);
    }
    return this.bindTarget(targetOrAction);
  }

  bindAction(action, keys) {
    if (!action || typeof action !== 'string') throw createOmniError('Input', 'Input.bind(action, keys) requires an action name.');
    const combos = normalizeCombos(keys);
    this.unbindAction(action);
    this.actionBindings.set(action, combos);
    for (const combo of combos) {
      if (!this.comboActions.has(combo)) this.comboActions.set(combo, new Set());
      this.comboActions.get(combo).add(action);
    }
    return () => this.unbindAction(action);
  }

  unbindAction(action) {
    const combos = this.actionBindings.get(action);
    if (!combos) return false;
    for (const combo of combos) {
      const actions = this.comboActions.get(combo);
      actions?.delete(action);
      if (actions?.size === 0) this.comboActions.delete(combo);
    }
    this.actionBindings.delete(action);
    return true;
  }

  bindTarget(target) {
    this.unbind();
    this.target = target;
    if (!target || typeof window === 'undefined') return;

    this._listen(window, 'keydown', (event) => this._handleKeyDown(event));
    this._listen(window, 'keyup', (event) => this._handleKeyUp(event));
    this._listen(window, 'resize', () => this.resizeTarget());
    this._listen(target, 'pointermove', (event) => {
      this._prevent(event);
      this._move(event);
      this.pointer.emit('move', this._payload(event));
    }, { passive: false });
    this._listen(target, 'pointerdown', (event) => {
      this._prevent(event);
      this.pointer.down = true;
      this._move(event);
      this.pointer.emit('down', this._payload(event));
    }, { passive: false });
    this._listen(target, 'pointerup', (event) => {
      this._prevent(event);
      this.pointer.down = false;
      this._move(event);
      this.pointer.emit('up', this._payload(event));
    }, { passive: false });
    this._listen(target, 'click', (event) => {
      this._prevent(event);
      this._move(event);
      this.pointer.emit('click', this._payload(event));
    }, { passive: false });
    this.resizeTarget();
  }

  update() {
    return {
      keyboard: this.keyboard,
      pointer: this.pointer
    };
  }

  destroy() {
    this.unbind();
    this.keyboard.clear();
    this.pointer.clear();
    this.actionBindings.clear();
    this.comboActions.clear();
    this.enabled = false;
  }

  resizeTarget() {
    if (!this.target) return;
    const rect = this.target.getBoundingClientRect?.() || {};
    const cssWidth = this.target.clientWidth || rect.width || this.target.width || 0;
    const cssHeight = this.target.clientHeight || rect.height || this.target.height || 0;
    const resolution = this.resolutionOverride || window.devicePixelRatio || 1;
    this.resolution = resolution;

    if (cssWidth > 0 && cssHeight > 0) {
      this.target.width = Math.max(1, Math.round(cssWidth * resolution));
      this.target.height = Math.max(1, Math.round(cssHeight * resolution));
      this.target.style.width = `${cssWidth}px`;
      this.target.style.height = `${cssHeight}px`;
    }
  }

  unbind() {
    for (const { target, event, handler, options } of this.listeners) {
      target.removeEventListener?.(event, handler, options);
    }
    this.listeners.length = 0;
  }

  _listen(target, event, handler, options = false) {
    target.addEventListener?.(event, handler, options);
    this.listeners.push({ target, event, handler, options });
  }

  _handleKeyDown(event) {
    this.keyboard.press(event.code || event.key);
    this._emitAction(event, true);
  }

  _handleKeyUp(event) {
    this.keyboard.release(event.code || event.key);
    this._emitAction(event, false);
  }

  _emitAction(event, down) {
    const combo = comboFromEvent(event);
    if (!combo) return;
    const actions = this.comboActions.get(combo);
    if (!actions?.size) return;
    if (this.preventDefault && event.cancelable) event.preventDefault();
    for (const action of actions) {
      this.events.emit(`action:${action}`, {
        action,
        combo,
        down,
        keys: [...this.keyboard.keys],
        originalEvent: event
      });
    }
  }

  _move(event) {
    const rect = this.target?.getBoundingClientRect?.() || { left: 0, top: 0 };
    this.pointer.position = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  _payload(event) {
    return {
      x: this.pointer.position.x,
      y: this.pointer.position.y,
      originalEvent: event
    };
  }

  _prevent(event) {
    if (this.preventDefault && event.cancelable) event.preventDefault();
  }
}

function normalizeCombos(keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  const combos = list.map((combo) => normalizeCombo(combo)).filter(Boolean);
  if (combos.length === 0) throw createOmniError('Input', 'Input.bind(action, keys) requires at least one key or combo.');
  return combos;
}

function normalizeCombo(combo) {
  const parts = String(combo)
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  const modifiers = new Set();
  let key = '';

  for (const part of parts) {
    const token = normalizeKeyToken(part);
    if (isModifier(token)) modifiers.add(token);
    else key = token;
  }

  return orderedCombo(modifiers, key);
}

function comboFromEvent(event) {
  const key = normalizeEventKey(event);
  if (!key || isModifier(key)) return null;
  const modifiers = new Set();
  if (event.ctrlKey) modifiers.add('Ctrl');
  if (event.altKey) modifiers.add('Alt');
  if (event.shiftKey) modifiers.add('Shift');
  if (event.metaKey) modifiers.add('Meta');
  return orderedCombo(modifiers, key);
}

function orderedCombo(modifiers, key) {
  return ['Ctrl', 'Alt', 'Shift', 'Meta']
    .filter((modifier) => modifiers.has(modifier))
    .concat(key ? [key] : [])
    .join('+');
}

function normalizeEventKey(event) {
  if (/^Key[A-Z]$/.test(event.code || '')) return event.code.slice(3);
  if (/^Digit\d$/.test(event.code || '')) return event.code.slice(5);
  return normalizeKeyToken(event.key || event.code || '');
}

function normalizeKeyToken(token) {
  const value = String(token).trim();
  const upper = value.toUpperCase();
  if (upper === 'CTRL' || upper === 'CONTROL' || upper === 'CONTROLLEFT' || upper === 'CONTROLRIGHT') return 'Ctrl';
  if (upper === 'ALT' || upper === 'ALTLEFT' || upper === 'ALTRIGHT' || upper === 'OPTION') return 'Alt';
  if (upper === 'SHIFT' || upper === 'SHIFTLEFT' || upper === 'SHIFTRIGHT') return 'Shift';
  if (upper === 'META' || upper === 'CMD' || upper === 'COMMAND' || upper === 'OS' || upper === 'METALEFT' || upper === 'METARIGHT') return 'Meta';
  if (upper === 'SPACE' || upper === 'SPACEBAR' || value === ' ') return 'Space';
  if (/^KEY[A-Z]$/.test(upper)) return upper.slice(3);
  if (/^DIGIT\d$/.test(upper)) return upper.slice(5);
  if (value.length === 1) return value.toUpperCase();
  return value;
}

function isModifier(token) {
  return token === 'Ctrl' || token === 'Alt' || token === 'Shift' || token === 'Meta';
}

export default InputManager;
