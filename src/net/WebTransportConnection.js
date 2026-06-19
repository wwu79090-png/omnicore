import { createOmniError, toOmniError } from '../core/OmniError.js';

function encodeEnvelope(envelope) {
  const text = JSON.stringify(envelope);
  if (typeof TextEncoder === 'undefined') return text;
  return new TextEncoder().encode(text);
}

function decodeEnvelope(payload) {
  const text = typeof payload === 'string'
    ? payload
    : new TextDecoder().decode(payload);
  return JSON.parse(text);
}

/**
 * Experimental Chrome WebTransport realtime wrapper.
 */
export class WebTransportConnection {
  constructor({
    url,
    WebTransportClass = globalThis.WebTransport,
    retryLimit = 0
  } = {}) {
    this.url = url;
    this.WebTransportClass = WebTransportClass;
    this.retryLimit = retryLimit;
    this.transport = 'webtransport';
    this.unstable = true;
    this.session = null;
    this.writer = null;
    this.reader = null;
    this.listeners = new Map();
    this.pendingAcks = new Map();
    this.nextSequence = 1;
    this.closed = false;
  }

  async open() {
    if (!this.WebTransportClass) {
      throw createOmniError('Net', 'WebTransport 仍是 Chrome 实验性 API，当前环境不可用。');
    }
    try {
      this.session = new this.WebTransportClass(this.url);
      await this.session.ready;
      this.writer = this.session.datagrams?.writable?.getWriter?.() || null;
      this.reader = this.session.datagrams?.readable?.getReader?.() || null;
      this._readLoop();
      return this;
    } catch (error) {
      throw toOmniError(error, { module: 'Net', message: `WebTransport 连接失败：${this.url}` });
    }
  }

  async send(payload, { reliable = false } = {}) {
    if (!this.writer) throw createOmniError('Net', 'WebTransport 尚未连接。');
    const sequence = this.nextSequence;
    this.nextSequence += 1;
    const envelope = {
      seq: sequence,
      reliable,
      payload
    };
    await this.writer.write(encodeEnvelope(envelope));
    if (reliable) {
      this.pendingAcks.set(sequence, {
        envelope,
        attempts: 1,
        retryLimit: this.retryLimit,
        sentAt: Date.now()
      });
    }
    return sequence;
  }

  ack(sequence) {
    return this.pendingAcks.delete(sequence);
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  close() {
    this.closed = true;
    this.reader?.releaseLock?.();
    this.writer?.releaseLock?.();
    this.session?.close?.();
  }

  async _readLoop() {
    if (!this.reader) return;
    try {
      while (!this.closed) {
        const { value, done } = await this.reader.read();
        if (done) break;
        const envelope = decodeEnvelope(value);
        if (envelope.ack) {
          this.ack(envelope.ack);
          this._emit('ack', envelope.ack);
        } else {
          this._emit('message', envelope.payload ?? envelope);
        }
      }
    } catch (error) {
      if (!this.closed) this._emit('error', toOmniError(error, { module: 'Net', message: 'WebTransport 数据读取失败。' }));
    }
  }

  _emit(event, payload) {
    for (const handler of this.listeners.get(event) || []) handler(payload);
  }
}

export default WebTransportConnection;
