/**
 * Browser-side debug log forwarder.
 *
 * When enabled in a real device build, console output is mirrored to the local
 * `npm run log-server` WebSocket endpoint so mobile logs can be inspected from
 * the PC terminal.
 *
 * @example
 * const forwarder = new LogForwarder({ url: 'ws://192.168.1.8:8787' });
 * forwarder.attach();
 */
export class LogForwarder {
  constructor({ url = 'ws://localhost:8787', consoleRef = globalThis.console } = {}) {
    this.url = url;
    this.consoleRef = consoleRef;
    this.socket = null;
    this.original = {};
    this.attached = false;
  }

  attach() {
    if (this.attached || typeof WebSocket === 'undefined') return false;
    this.attached = true;
    this.socket = new WebSocket(this.url);
    ['log', 'warn', 'error', 'info'].forEach((level) => {
      this.original[level] = this.consoleRef[level]?.bind(this.consoleRef) || (() => {});
      this.consoleRef[level] = (...args) => {
        this.original[level](...args);
        this.forward(level, args);
      };
    });
    return true;
  }

  forward(level, args) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    const payload = {
      level,
      at: new Date().toISOString(),
      args: args.map((item) => {
        if (item instanceof Error) return { name: item.name, message: item.message, stack: item.stack };
        if (typeof item === 'object') {
          try {
            return JSON.parse(JSON.stringify(item));
          } catch {
            return String(item);
          }
        }
        return item;
      })
    };
    this.socket.send(JSON.stringify(payload));
  }

  detach() {
    if (!this.attached) return;
    Object.entries(this.original).forEach(([level, handler]) => {
      this.consoleRef[level] = handler;
    });
    this.original = {};
    this.socket?.close?.();
    this.socket = null;
    this.attached = false;
  }
}

export default LogForwarder;
