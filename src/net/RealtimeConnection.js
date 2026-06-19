import { createOmniError } from '../core/OmniError.js';

function encode(payload) {
  return typeof payload === 'string' ? payload : JSON.stringify(payload);
}

/**
 * WebSocket-compatible realtime connection wrapper.
 */
export class RealtimeConnection {
  constructor({
    url,
    WebSocketClass = globalThis.WebSocket
  } = {}) {
    this.url = url;
    this.WebSocketClass = WebSocketClass;
    this.transport = 'websocket';
    this.unstable = false;
    this.socket = null;
    this.listeners = new Map();
  }

  async open() {
    if (!this.WebSocketClass) throw createOmniError('Net', '当前环境不支持 WebSocket。');
    this.socket = new this.WebSocketClass(this.url);
    this.socket.onmessage = (event) => this._emit('message', event.data);
    this.socket.onerror = (event) => this._emit('error', event);
    this.socket.onclose = (event) => this._emit('close', event);
    if (this.socket.readyState === 1) return this;
    await new Promise((resolve, reject) => {
      this.socket.onopen = () => resolve();
      this.socket.onerror = (event) => reject(createOmniError('Net', 'WebSocket 连接失败。', { cause: event }));
    });
    return this;
  }

  send(payload) {
    this.socket?.send?.(encode(payload));
    return payload;
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  close(code, reason) {
    this.socket?.close?.(code, reason);
  }

  _emit(event, payload) {
    for (const handler of this.listeners.get(event) || []) handler(payload);
  }
}

export default RealtimeConnection;
