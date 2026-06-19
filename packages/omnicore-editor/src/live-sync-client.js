import { applyLiveSyncMessage, createEditorState, createLiveSyncMessage } from './live-sync-protocol.js';

export class LiveSyncClient {
  constructor({ url = 'ws://127.0.0.1:17361', onState = null, WebSocketImpl = globalThis.WebSocket } = {}) {
    this.url = url;
    this.onState = onState;
    this.WebSocketImpl = WebSocketImpl;
    this.socket = null;
    this.state = createEditorState();
  }

  connect() {
    if (!this.WebSocketImpl) return this;
    this.socket = new this.WebSocketImpl(this.url);
    this.socket.addEventListener?.('open', () => {
      this.state = { ...this.state, connected: true };
      this.onState?.(this.state);
      this.send('editor:hello', { version: '0.1.0' });
    });
    this.socket.addEventListener?.('message', (event) => {
      const message = JSON.parse(event.data);
      this.state = applyLiveSyncMessage(this.state, message);
      this.onState?.(this.state);
    });
    return this;
  }

  send(type, payload = {}) {
    const message = createLiveSyncMessage(type, payload);
    this.socket?.send?.(JSON.stringify(message));
    return message;
  }

  close() {
    this.socket?.close?.();
    this.socket = null;
  }
}

export default LiveSyncClient;
