import EventBus from '../core/EventBus.js';
import { createOmniError } from '../core/OmniError.js';

/**
 * Room-style WebSocket wrapper for multiplayer MVPs.
 */
export class NetRoom {
  constructor({
    url,
    socketFactory = (targetUrl) => new WebSocket(targetUrl),
    events = new EventBus()
  } = {}) {
    this.url = url;
    this.socketFactory = socketFactory;
    this.events = events;
    this.socket = null;
    this.room = null;
  }

  connect() {
    if (!this.url) throw createOmniError('NetRoom', '房间服务器 URL 不能为空。');
    if (this.socket) return this.socket;
    this.socket = this.socketFactory(this.url);
    this.socket.onmessage = (event) => this._handleMessage(event);
    this.socket.onopen = () => this.events.emit('room:open', { room: this.room });
    this.socket.onclose = () => this.events.emit('room:close', { room: this.room });
    return this.socket;
  }

  join(room, payload = {}) {
    this.room = room;
    this.connect();
    this._send({ type: 'join', room, payload });
    return this;
  }

  emit(event, payload = {}) {
    if (!this.room) throw createOmniError('NetRoom', '请先调用 join(room)。');
    this.connect();
    this._send({ type: 'event', room: this.room, event, payload });
    return this;
  }

  on(event, handler) {
    return this.events.on(event, handler);
  }

  close() {
    this.socket?.close?.();
    this.socket = null;
  }

  _send(message) {
    if (!this.socket || (this.socket.readyState != null && this.socket.readyState > 1)) {
      throw createOmniError('NetRoom', 'WebSocket 房间连接不可用。');
    }
    this.socket.send?.(JSON.stringify(message));
  }

  _handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      this.events.emit(message.event || message.type || 'message', message);
    } catch {
      this.events.emit('room:message', { raw: event.data });
    }
  }
}

export default NetRoom;
