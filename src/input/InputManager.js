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
  constructor({
    ignoreTags = ['INPUT', 'TEXTAREA'],
    ignoreContentEditable = true
  } = {}) {
    this.keys = new Set();
    this.normalizedKeys = new Set();
    this.justPressed = new Set();
    this.justReleased = new Set();
    this.enabled = true;
    this.ignoreTags = new Set(ignoreTags.map((tag) => String(tag).toUpperCase()));
    this.ignoreContentEditable = ignoreContentEditable !== false;
  }

  isDown(code) {
    return this.keys.has(code) || this.normalizedKeys.has(normalizeKeyToken(code));
  }

  isCombo(keys = []) {
    const list = Array.isArray(keys) ? keys : String(keys).split('+');
    return list
      .map((key) => normalizeKeyToken(key))
      .filter(Boolean)
      .every((key) => this.normalizedKeys.has(key));
  }

  press(code) {
    if (!this.enabled) return;
    const normalized = normalizeKeyToken(code);
    if (!this.keys.has(code) && !this.normalizedKeys.has(normalized)) this.justPressed.add(normalized);
    this.keys.add(code);
    this.normalizedKeys.add(normalized);
  }

  release(code) {
    const normalized = normalizeKeyToken(code);
    if (this.keys.has(code) || this.normalizedKeys.has(normalized)) this.justReleased.add(normalized);
    this.keys.delete(code);
    this.normalizedKeys.delete(normalized);
  }

  justDown(code) {
    const normalized = normalizeKeyToken(code);
    const result = this.justPressed.has(normalized);
    this.justPressed.delete(normalized);
    return result;
  }

  justUp(code) {
    const normalized = normalizeKeyToken(code);
    const result = this.justReleased.has(normalized);
    this.justReleased.delete(normalized);
    return result;
  }

  clear() {
    this.keys.clear();
    this.normalizedKeys.clear();
    this.justPressed.clear();
    this.justReleased.clear();
  }

  shouldIgnoreEvent(event = {}) {
    const target = event?.target || null;
    if (this.isIgnoredElement(target)) return true;
    const activeElement = target?.ownerDocument?.activeElement || globalThis.document?.activeElement || null;
    return this.isIgnoredElement(activeElement);
  }

  isIgnoredElement(target) {
    if (!target) return false;
    const { tagName = '', isContentEditable = false } = target;
    const tag = String(tagName).toUpperCase();
    if (this.ignoreTags.has(tag)) return true;
    if (this.ignoreContentEditable && isContentEditable === true) return true;
    return false;
  }
}

class PointerState {
  constructor() {
    this.events = new EventBus();
    this.position = { x: 0, y: 0 };
    this.down = false;
    this.propagationDisposers = [];
  }

  on(event, handler) {
    return this.events.on(event, handler);
  }

  emit(event, payload) {
    this.events.emit(event, payload);
  }

  enableEventPropagation(domElement, {
    pointerEvents = 'auto',
    events = ['pointerdown', 'pointerup', 'pointermove', 'click', 'wheel', 'touchstart', 'touchend', 'touchmove']
  } = {}) {
    if (!domElement?.addEventListener) {
      throw createOmniError('Input', 'pointer.enableEventPropagation(domElement) requires a DOM element.');
    }
    const previousPointerEvents = domElement.style?.pointerEvents || '';
    if (domElement.style) domElement.style.pointerEvents = pointerEvents;
    const stop = (event) => {
      event.stopPropagation?.();
    };
    for (const event of events) {
      domElement.addEventListener(event, stop, { capture: true });
    }
    const cleanup = () => {
      for (const event of events) {
        domElement.removeEventListener(event, stop, { capture: true });
      }
      if (domElement.style) domElement.style.pointerEvents = previousPointerEvents;
      this.propagationDisposers = this.propagationDisposers.filter((item) => item !== cleanup);
    };
    this.propagationDisposers.push(cleanup);
    return cleanup;
  }

  clear() {
    for (const dispose of [...this.propagationDisposers]) dispose();
    this.propagationDisposers.length = 0;
    this.events.clear();
    this.position = { x: 0, y: 0 };
    this.down = false;
  }
}

export class InputManager {
  constructor({
    target = null,
    preventDefault = true,
    resolution = null,
    events = null,
    keyboard = {},
    ignoreTags = undefined,
    lockBrowserGestures = true
  } = {}) {
    this.target = target;
    this.preventDefault = preventDefault;
    this.resolutionOverride = resolution;
    this.resolution = resolution || 1;
    this.events = events || new EventBus();
    this.lockBrowserGestures = lockBrowserGestures !== false;
    this.keyboard = new KeyboardState({
      ...keyboard,
      ignoreTags: ignoreTags ?? keyboard.ignoreTags
    });
    this.pointer = new PointerState();
    this.mouse = this.pointer;
    this.actionBindings = new Map();
    this.comboActions = new Map();
    this.actionMap = new Map();
    this.actionStates = new Map();
    this.actionJustPressed = new Set();
    this.actionJustReleased = new Set();
    this.focusScopes = [];
    this.gamepads = new Map();
    this.listeners = [];
    this.enabled = true;
    this.dragThreshold = 4;
    this.doubleClickMs = 300;
    this.swipeThreshold = 32;
    this.pointerDownPayload = null;
    this.lastClickPayload = null;
    this.pinchState = null;
    this.lastFrame = null;
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
    this.actionMap.set(action, combos.map((combo) => ({ type: 'keyboard', combo })));
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
    this.actionMap.delete(action);
    this.actionStates.delete(action);
    this.actionJustPressed.delete(action);
    this.actionJustReleased.delete(action);
    return true;
  }

  mapAction(action, bindings = [], options = {}) {
    if (!action || typeof action !== 'string') throw createOmniError('Input', 'mapAction(action, bindings) requires an action name.');
    const normalizedBindings = normalizeActionBindings(bindings);
    if (normalizedBindings.length === 0) throw createOmniError('Input', 'mapAction(action, bindings) requires at least one binding.');
    this.unbindAction(action);
    this.actionMap.set(action, normalizedBindings);
    const combos = normalizedBindings
      .filter((binding) => binding.type === 'keyboard')
      .map((binding) => binding.combo);
    if (combos.length) {
      this.actionBindings.set(action, combos);
      for (const combo of combos) {
        if (!this.comboActions.has(combo)) this.comboActions.set(combo, new Set());
        this.comboActions.get(combo).add(action);
      }
    }
    if (options.initialDown) this.actionStates.set(action, true);
    return () => this.unbindAction(action);
  }

  isActionDown(action) {
    if (!this.isActionAllowed(action)) return false;
    if (this.actionStates.get(action) === true) return true;
    const bindings = this.actionMap.get(action) || [];
    return bindings.some((binding) => binding.type === 'keyboard' && this.keyboard.isCombo(binding.combo));
  }

  justActionDown(action) {
    const result = this.actionJustPressed.has(action);
    this.actionJustPressed.delete(action);
    return result;
  }

  justActionUp(action) {
    const result = this.actionJustReleased.has(action);
    this.actionJustReleased.delete(action);
    return result;
  }

  triggerAction(action, {
    down = true,
    value = down ? 1 : 0,
    source = 'manual',
    originalEvent = null,
    ...extra
  } = {}) {
    if (!this.isActionAllowed(action)) return null;
    const wasDown = this.actionStates.get(action) === true;
    this.actionStates.set(action, Boolean(down));
    if (down && !wasDown) this.actionJustPressed.add(action);
    if (!down && wasDown) this.actionJustReleased.add(action);
    const payload = {
      action,
      down: Boolean(down),
      value,
      source,
      originalEvent,
      ...extra
    };
    this.events.emit(`action:${action}`, payload);
    this.events.emit('action', payload);
    return payload;
  }

  pushFocusScope({ id = `scope-${this.focusScopes.length + 1}`, actions = null, capture = true } = {}) {
    const scope = {
      id,
      actions: actions ? new Set(actions) : null,
      capture: capture !== false
    };
    this.focusScopes.push(scope);
    return () => this.popFocusScope(id);
  }

  popFocusScope(id = null) {
    if (!id) return this.focusScopes.pop() || null;
    const index = this.focusScopes.findIndex((scope) => scope.id === id);
    if (index < 0) return null;
    return this.focusScopes.splice(index, 1)[0] || null;
  }

  isActionAllowed(action) {
    const scope = this.focusScopes[this.focusScopes.length - 1];
    if (!scope || !scope.capture || !scope.actions) return true;
    return scope.actions.has(action);
  }

  setGamepadState(index = 0, state = {}) {
    this.gamepads.set(index, state);
    for (const [action, bindings] of this.actionMap) {
      for (const binding of bindings) {
        if (binding.type !== 'gamepad' || binding.index !== index) continue;
        const button = state.buttons?.[binding.button];
        const value = typeof button === 'object' ? Number(button.value || 0) : Number(button || 0);
        const down = value >= binding.threshold;
        this.triggerAction(action, { down, value, source: 'gamepad' });
      }
    }
    return state;
  }

  bindTarget(target) {
    this.unbind();
    this.target = target;
    if (!target || typeof window === 'undefined') return;
    this._lockTargetBrowserGestures(target);

    this._listen(window, 'keydown', (event) => this._handleKeyDown(event));
    this._listen(window, 'keyup', (event) => this._handleKeyUp(event));
    this._listen(window, 'resize', () => this.resizeTarget());
    const ownerDocument = target.ownerDocument || globalThis.document;
    if (ownerDocument) this._listen(ownerDocument, 'focusin', (event) => this._handleFocusIn(event));
    this._listen(target, 'pointermove', (event) => {
      this._prevent(event);
      this._move(event);
      const payload = this._payload(event);
      this.pointer.emit('move', payload);
      this._emitDrag(event, payload);
    }, { passive: false });
    this._listen(target, 'pointerdown', (event) => {
      this._prevent(event);
      this.pointer.down = true;
      this._move(event);
      const payload = this._payload(event);
      this.pointerDownPayload = payload;
      this.pointer.emit('down', payload);
      this._emitPointerAction('down', payload, event);
    }, { passive: false });
    this._listen(target, 'pointerup', (event) => {
      this._prevent(event);
      this.pointer.down = false;
      this._move(event);
      const payload = this._payload(event);
      this.pointer.emit('up', payload);
      this._emitPointerAction('up', payload, event);
      this._emitSwipe(payload);
      this.pointerDownPayload = null;
    }, { passive: false });
    this._listen(target, 'click', (event) => {
      this._prevent(event);
      this._move(event);
      const payload = this._payload(event);
      this.pointer.emit('click', payload);
      this._emitPointerAction('click', payload, event);
      this._emitDoubleClick(payload);
    }, { passive: false });
    this._listen(target, 'wheel', (event) => {
      this._prevent(event);
      this._move(event);
      this.pointer.emit('wheel', {
        ...this._payload(event),
        deltaX: Number(event.deltaX || 0),
        deltaY: Number(event.deltaY || 0),
        deltaZ: Number(event.deltaZ || 0),
        deltaMode: Number(event.deltaMode || 0)
      });
    }, { passive: false });
    this._listen(target, 'touchstart', (event) => this._handleTouchStart(event), { passive: false });
    this._listen(target, 'touchmove', (event) => this._handleTouchMove(event), { passive: false });
    this._listen(target, 'touchend', (event) => this._handleTouchEnd(event), { passive: false });
    this._listen(target, 'touchcancel', (event) => this._handleTouchEnd(event), { passive: false });
    this.resizeTarget();
  }

  refresh(delta = 0, time = performanceNow()) {
    if (this.keyboard.shouldIgnoreEvent({ target: null })) this._suspendKeyboardForTextEntry();
    this.lastFrame = {
      delta,
      time,
      keyboard: this.keyboard,
      pointer: this.pointer
    };
    return {
      keyboard: this.keyboard,
      pointer: this.pointer,
      frame: this.lastFrame
    };
  }

  update(delta = 0, time = performanceNow()) {
    return this.refresh(delta, time);
  }

  disableAll() {
    this.enabled = false;
    this.keyboard.enabled = false;
    this.keyboard.clear();
    this.pointer.down = false;
    this.pointerDownPayload = null;
    return this;
  }

  enableAll() {
    this.enabled = true;
    this.keyboard.enabled = true;
    return this;
  }

  destroy() {
    this.unbind();
    this.keyboard.clear();
    this.pointer.clear();
    this.actionBindings.clear();
    this.comboActions.clear();
    this.actionMap.clear();
    this.actionStates.clear();
    this.actionJustPressed.clear();
    this.actionJustReleased.clear();
    this.focusScopes.length = 0;
    this.gamepads.clear();
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

  setCursor(cursor = 'default') {
    if (cursor !== 'pointer' && cursor !== 'default') {
      throw createOmniError('Input', 'setCursor(cursor) only supports "pointer" or "default" cursor values.');
    }
    this.cursor = cursor;
    if (this.target?.style) this.target.style.cursor = cursor;
    return this;
  }

  unbind() {
    for (const { target, event, handler, options } of this.listeners) {
      target.removeEventListener?.(event, handler, options);
    }
    this.listeners.length = 0;
    this.pointerDownPayload = null;
    this.lastClickPayload = null;
    this.pinchState = null;
    this.lastFrame = null;
  }

  _listen(target, event, handler, options = false) {
    target.addEventListener?.(event, handler, options);
    this.listeners.push({ target, event, handler, options });
  }

  _lockTargetBrowserGestures(target) {
    if (!this.lockBrowserGestures || !target?.style) return;
    target.style.touchAction = 'none';
    target.style.userSelect = 'none';
    target.style.webkitUserSelect = 'none';
  }

  _handleKeyDown(event) {
    if (!this.enabled) return;
    if (this.keyboard.shouldIgnoreEvent(event)) {
      this._suspendKeyboardForTextEntry();
      return;
    }
    this.keyboard.press(event.code || event.key);
    this._emitAction(event, true);
  }

  _handleKeyUp(event) {
    if (!this.enabled) return;
    if (this.keyboard.shouldIgnoreEvent(event)) {
      this._suspendKeyboardForTextEntry();
      return;
    }
    this.keyboard.release(event.code || event.key);
    this._emitAction(event, false);
  }

  _handleFocusIn(event) {
    if (this.keyboard.shouldIgnoreEvent(event)) this._suspendKeyboardForTextEntry();
  }

  _suspendKeyboardForTextEntry() {
    this.keyboard.clear();
    this.actionStates.clear();
    this.actionJustPressed.clear();
    this.actionJustReleased.clear();
  }

  _emitAction(event, down) {
    const combo = comboFromEvent(event);
    if (!combo) return;
    const actions = this.comboActions.get(combo);
    if (!actions?.size) return;
    if (this.preventDefault && event.cancelable) event.preventDefault();
    for (const action of actions) {
      this.triggerAction(action, {
        action,
        combo,
        down,
        value: down ? 1 : 0,
        source: 'keyboard',
        keys: [...this.keyboard.keys],
        originalEvent: event
      });
    }
  }

  _emitPointerAction(eventName, payload, originalEvent) {
    for (const [action, bindings] of this.actionMap) {
      if (!this.isActionAllowed(action)) continue;
      for (const binding of bindings) {
        if (binding.type === 'pointer' && binding.event === eventName) {
          this.triggerAction(action, {
            down: eventName !== 'up',
            value: eventName === 'up' ? 0 : 1,
            source: 'pointer',
            originalEvent
          });
        }
        if (binding.type === 'touch' && binding.event === eventName) {
          this.triggerAction(action, {
            down: eventName !== 'up',
            value: eventName === 'up' ? 0 : 1,
            source: 'touch',
            originalEvent
          });
        }
      }
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
      clientX: Number(event.clientX ?? this.pointer.position.x),
      clientY: Number(event.clientY ?? this.pointer.position.y),
      timeStamp: Number(event.timeStamp || performanceNow()),
      originalEvent: event
    };
  }

  _prevent(event) {
    if (this.preventDefault && event.cancelable) event.preventDefault();
  }

  _emitDrag(event, payload) {
    if (!this.pointer.down || !this.pointerDownPayload) return;
    const dx = payload.x - this.pointerDownPayload.x;
    const dy = payload.y - this.pointerDownPayload.y;
    const distance = Math.hypot(dx, dy);
    if (distance < this.dragThreshold) return;
    this.pointer.emit('drag', {
      ...payload,
      startX: this.pointerDownPayload.x,
      startY: this.pointerDownPayload.y,
      dx,
      dy,
      distance,
      originalEvent: event
    });
  }

  _emitDoubleClick(payload) {
    const previousClick = this.lastClickPayload;
    this.lastClickPayload = payload;
    if (!previousClick) return;
    const intervalMs = payload.timeStamp - previousClick.timeStamp;
    const distance = Math.hypot(payload.x - previousClick.x, payload.y - previousClick.y);
    if (intervalMs <= this.doubleClickMs && distance <= this.dragThreshold) {
      this.pointer.emit('doubleClick', {
        ...payload,
        previousClick,
        intervalMs,
        distance
      });
    }
  }

  _handleTouchStart(event) {
    this._prevent(event);
    const touches = normalizeTouches(event.touches, this.target);
    if (touches.length >= 2) this.pinchState = createPinchState(touches[0], touches[1]);
  }

  _handleTouchMove(event) {
    this._prevent(event);
    const touches = normalizeTouches(event.touches, this.target);
    if (touches.length < 2 || !this.pinchState) return;
    const next = createPinchState(touches[0], touches[1]);
    this.pointer.emit('pinch', {
      ...next,
      previousDistance: this.pinchState.distance,
      scale: next.distance / Math.max(1, this.pinchState.distance),
      originalEvent: event
    });
    this.pinchState = next;
  }

  _handleTouchEnd(event) {
    this._prevent(event);
    if (!event.touches || event.touches.length < 2) this.pinchState = null;
  }

  _emitSwipe(payload) {
    if (!this.pointerDownPayload) return;
    const dx = payload.x - this.pointerDownPayload.x;
    const dy = payload.y - this.pointerDownPayload.y;
    const distance = Math.hypot(dx, dy);
    if (distance < this.swipeThreshold) return;
    this.pointer.emit('swipe', {
      ...payload,
      startX: this.pointerDownPayload.x,
      startY: this.pointerDownPayload.y,
      dx,
      dy,
      distance,
      direction: swipeDirection(dx, dy)
    });
  }
}

function performanceNow() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function normalizeTouches(touches, target) {
  const rect = target?.getBoundingClientRect?.() || { left: 0, top: 0 };
  return Array.from(touches || []).map((touch) => ({
    id: touch.identifier,
    x: Number(touch.clientX || 0) - rect.left,
    y: Number(touch.clientY || 0) - rect.top,
    clientX: Number(touch.clientX || 0),
    clientY: Number(touch.clientY || 0)
  }));
}

function createPinchState(left, right) {
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  return {
    distance: Math.hypot(dx, dy),
    centerX: (left.x + right.x) / 2,
    centerY: (left.y + right.y) / 2,
    touches: [left, right]
  };
}

function swipeDirection(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}

function normalizeCombos(keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  const combos = list.map((combo) => normalizeCombo(combo)).filter(Boolean);
  if (combos.length === 0) throw createOmniError('Input', 'Input.bind(action, keys) requires at least one key or combo.');
  return combos;
}

function normalizeActionBindings(bindings) {
  const list = Array.isArray(bindings) ? bindings : [bindings];
  return list.map((binding) => {
    if (typeof binding === 'string') {
      return { type: 'keyboard', combo: normalizeCombo(binding) };
    }
    if (!binding || typeof binding !== 'object') return null;
    const type = binding.type || (binding.button != null ? 'gamepad' : 'keyboard');
    if (type === 'keyboard') return { type, combo: normalizeCombo(binding.combo || binding.key || binding.keys) };
    if (type === 'pointer') return { type, event: binding.event || 'down', button: binding.button ?? 0 };
    if (type === 'touch') return { type, event: binding.event || 'down' };
    if (type === 'gamepad') {
      return {
        type,
        index: Number(binding.index || 0),
        button: Number(binding.button || 0),
        threshold: Number(binding.threshold ?? 0.5)
      };
    }
    return null;
  }).filter((binding) => binding && (binding.type !== 'keyboard' || binding.combo));
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
