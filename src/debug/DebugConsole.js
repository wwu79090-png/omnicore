import ErrorDiagnostics from './ErrorDiagnostics.js';

/**
 * WebSocket debug terminal for device logs and OmniCore events.
 *
 * @example
 * const consoleSync = new DebugConsole({ events: game.events });
 * consoleSync.attach();
 */
export class DebugConsole {
  constructor({
    url = 'ws://localhost:8787',
    socketFactory = null,
    consoleRef = globalThis.console,
    events = null
  } = {}) {
    this.url = url;
    this.socketFactory = socketFactory;
    this.consoleRef = consoleRef;
    this.events = events;
    this.socket = null;
    this.original = {};
    this.detachEvent = null;
  }

  attach() {
    if (this.socket) return this;
    this.socket = this.socketFactory?.(this.url) || (typeof WebSocket !== 'undefined' ? new WebSocket(this.url) : null);
    for (const level of ['log', 'warn', 'error', 'info']) {
      this.original[level] = this.consoleRef[level]?.bind(this.consoleRef) || (() => {});
      this.consoleRef[level] = (...args) => {
        this.original[level](...args);
        const diagnostic = level === 'error' ? this._diagnose(args) : null;
        this._send({ type: 'console', level, args, diagnostic });
      };
    }
    this._patchEventBus();
    return this;
  }

  detach() {
    for (const [level, handler] of Object.entries(this.original)) this.consoleRef[level] = handler;
    this.original = {};
    this.detachEvent?.();
    this.detachEvent = null;
    this.socket?.close?.();
    this.socket = null;
  }

  _patchEventBus() {
    if (!this.events?.emit || this.detachEvent) return;
    const originalEmit = this.events.emit.bind(this.events);
    this.events.emit = (event, payload) => {
      this._send({ type: 'event', event, payload });
      return originalEmit(event, payload);
    };
    this.detachEvent = () => {
      this.events.emit = originalEmit;
    };
  }

  _send(payload) {
    if (!this.socket || this.socket.readyState !== 1) return;
    this.socket.send(JSON.stringify({
      ...payload,
      at: new Date().toISOString()
    }));
  }

  _diagnose(args) {
    const source = args.find((item) => item instanceof Error) || args.map(String).join(' ');
    return ErrorDiagnostics.analyze(source);
  }
}

export default DebugConsole;
