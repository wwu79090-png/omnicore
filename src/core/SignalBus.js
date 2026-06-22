/**
 * Godot-style named signal hub for runtime objects and editor tools.
 */
export class SignalBus {
  constructor() {
    this.listeners = new Map();
  }

  signal(name) {
    return {
      name,
      connect: (handler, options = {}) => this.on(name, handler, options),
      emit: (...args) => this.emit(name, ...args),
      disconnect: (handler) => this.off(name, handler)
    };
  }

  on(name, handler, options = {}) {
    if (typeof handler !== 'function') return () => {};
    const listeners = this.listeners.get(name) || new Set();
    let disconnect = null;
    const entry = {
      handler,
      once: Boolean(options.once),
      wrapped: (...args) => {
        handler(...args);
        if (entry.once) disconnect?.();
      }
    };
    listeners.add(entry);
    this.listeners.set(name, listeners);
    disconnect = () => this.off(name, handler);
    return disconnect;
  }

  off(name, handler = null) {
    const listeners = this.listeners.get(name);
    if (!listeners) return;
    if (!handler) {
      listeners.clear();
      this.listeners.delete(name);
      return;
    }
    for (const entry of [...listeners]) {
      if (entry.handler === handler || entry.wrapped === handler) listeners.delete(entry);
    }
    if (listeners.size === 0) this.listeners.delete(name);
  }

  connect(sourceSignal, target, targetSignalOrHandler = sourceSignal, options = {}) {
    const relay = createSignalRelay(target, targetSignalOrHandler);
    return this.on(sourceSignal, relay, options);
  }

  emit(name, ...args) {
    const listeners = [...(this.listeners.get(name) || [])];
    for (const entry of listeners) entry.wrapped(...args);
    return listeners.length;
  }

  clear() {
    this.listeners.clear();
  }
}

function createSignalRelay(target, targetSignalOrHandler) {
  if (typeof targetSignalOrHandler === 'function') return targetSignalOrHandler;
  return (...args) => {
    if (target instanceof SignalBus) {
      target.emit(targetSignalOrHandler, ...args);
      return;
    }
    if (typeof target?.emit === 'function') {
      target.emit(targetSignalOrHandler, ...args);
      return;
    }
    if (typeof target?.signal === 'function') {
      target.signal(targetSignalOrHandler).emit(...args);
    }
  };
}

export default SignalBus;
