import { createOmniError } from './OmniError.js';

export class MessageRouteBus {
  constructor() {
    this.handlers = new Map();
    this.queue = [];
    this.deadLetters = [];
    this.proxies = new Map();
  }

  register(target, handler) {
    const address = normalizeAddress(target);
    if (typeof handler !== 'function') {
      throw createOmniError('MessageRouteBus', `Handler must be a function for target: ${address}`);
    }
    if (!this.handlers.has(address)) this.handlers.set(address, new Set());
    this.handlers.get(address).add(handler);
    return () => this.handlers.get(address)?.delete(handler);
  }

  post(sender, target, messageId, payload = {}) {
    this.queue.push({
      sender: normalizeAddress(sender),
      target: normalizeAddress(target),
      messageId: String(messageId),
      payload: clone(payload)
    });
    return this;
  }

  flush(limit = 1000) {
    let delivered = 0;
    let processed = 0;
    while (this.queue.length > 0) {
      if (processed >= limit) throw createOmniError('MessageRouteBus', `Message queue exceeded flush limit: ${limit}`);
      processed += 1;
      const message = this.queue.shift();
      const handlers = this.handlers.get(message.target);
      if (!handlers || handlers.size === 0) {
        this.deadLetters.push(clone(message));
        continue;
      }
      for (const handler of handlers) {
        handler(clone(message));
        delivered += 1;
      }
    }
    return delivered;
  }

  defineProxy(id, { collection = id, loaded = false, initialized = false, enabled = false } = {}) {
    const key = String(id);
    this.proxies.set(key, {
      id: key,
      collection: String(collection),
      loaded: Boolean(loaded),
      initialized: Boolean(initialized),
      enabled: Boolean(enabled)
    });
    return this;
  }

  sendProxy(id, messageId, { sender = null } = {}) {
    const proxy = this._proxy(id);
    const message = String(messageId);
    if (message === 'load') {
      proxy.loaded = true;
      proxy.initialized = false;
      proxy.enabled = false;
      if (sender) {
        this.post(`proxy:${proxy.id}`, sender, 'proxy_loaded', {
          proxy: proxy.id,
          collection: proxy.collection
        });
      }
    } else if (message === 'init') {
      assertProxyLoaded(proxy, message);
      proxy.initialized = true;
    } else if (message === 'enable') {
      assertProxyLoaded(proxy, message);
      proxy.enabled = true;
    } else if (message === 'disable') {
      proxy.enabled = false;
    } else if (message === 'unload') {
      proxy.loaded = false;
      proxy.initialized = false;
      proxy.enabled = false;
    } else {
      throw createOmniError('MessageRouteBus', `Unsupported proxy message: ${message}`);
    }
    return this;
  }

  proxyState(id) {
    return clone(this._proxy(id));
  }

  _proxy(id) {
    const proxy = this.proxies.get(String(id));
    if (!proxy) throw createOmniError('MessageRouteBus', `Collection proxy is not registered: ${id}`);
    return proxy;
  }
}

function assertProxyLoaded(proxy, message) {
  if (!proxy.loaded) {
    throw createOmniError('MessageRouteBus', `Cannot ${message} unloaded proxy: ${proxy.id}`);
  }
}

function normalizeAddress(address) {
  return String(address || 'default:/#script');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default MessageRouteBus;
