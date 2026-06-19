import EventBus from './EventBus.js';
import { createOmniError } from './OmniError.js';

const SANDBOX_EVENT_TYPE = 'omnicore:sandbox:event';
let sandboxSequence = 0;

function nextSandboxId() {
  sandboxSequence += 1;
  return `omnicore-sandbox-${sandboxSequence}`;
}

function canUseDom() {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

function isIframeElement(target) {
  return target?.tagName?.toLowerCase?.() === 'iframe';
}

function escapeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function createIframeBootstrap({ id, config, moduleUrl }) {
  const importLine = moduleUrl
    ? `import('${moduleUrl}').then((module) => {
        const OmniCore = module.default || module;
        if (OmniCore?.Game) {
          const game = new OmniCore.Game(window.__OMNICORE_SANDBOX_CONFIG__);
          window.__OMNICORE_SANDBOX_GAME__ = game;
          return game.init?.();
        }
        return null;
      });`
    : '';

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>OmniCore Sandbox ${id}</title></head>
<body>
<script>
window.__OMNICORE_SANDBOX_ID__ = ${escapeScriptJson(id)};
window.__OMNICORE_SANDBOX_CONFIG__ = ${escapeScriptJson(config)};
window.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.type !== '${SANDBOX_EVENT_TYPE}') return;
  window.dispatchEvent(new CustomEvent('omnicore:sandbox:event', { detail: message }));
});
window.parent?.postMessage?.({
  type: '${SANDBOX_EVENT_TYPE}',
  channel: 'sandbox:ready',
  payload: { id: window.__OMNICORE_SANDBOX_ID__ },
  source: window.__OMNICORE_SANDBOX_ID__
}, '*');
${importLine}
</script>
</body>
</html>`;
}

export class SandboxBus {
  constructor({ windowRef = typeof window !== 'undefined' ? window : null } = {}) {
    this.windowRef = windowRef;
    this.events = new EventBus();
    this.sandboxes = new Map();
    this.handleMessage = this.handleMessage.bind(this);
    this.listening = false;
  }

  ensureListening() {
    if (this.listening || !this.windowRef?.addEventListener) return;
    this.windowRef.addEventListener('message', this.handleMessage);
    this.listening = true;
  }

  stopListening() {
    if (!this.listening || !this.windowRef?.removeEventListener) return;
    this.windowRef.removeEventListener('message', this.handleMessage);
    this.listening = false;
  }

  register(sandbox) {
    this.sandboxes.set(sandbox.id, sandbox);
    this.ensureListening();
    return () => this.unregister(sandbox.id);
  }

  unregister(id) {
    this.sandboxes.delete(id);
    if (this.sandboxes.size === 0) this.stopListening();
  }

  subscribe(channel, handler) {
    return this.events.on(channel, handler);
  }

  publish(channel, payload, options = {}) {
    const message = {
      type: SANDBOX_EVENT_TYPE,
      channel,
      payload,
      source: options.source || null,
      timestamp: options.timestamp || Date.now()
    };
    this.events.emit(channel, message);

    if (options.broadcast !== false) {
      for (const sandbox of this.sandboxes.values()) {
        if (sandbox.id === message.source) continue;
        sandbox.deliver(message, options.targetOrigin);
      }
    }

    return message;
  }

  handleMessage(event) {
    const data = event.data || {};
    if (data.type !== SANDBOX_EVENT_TYPE || !data.channel) return;
    const source = data.source || this.findSandboxByWindow(event.source)?.id || null;
    this.publish(data.channel, data.payload, {
      source,
      targetOrigin: data.targetOrigin || '*'
    });
  }

  findSandboxByWindow(sourceWindow) {
    if (!sourceWindow) return null;
    for (const sandbox of this.sandboxes.values()) {
      if (sandbox.transport === 'iframe' && sandbox.target?.contentWindow === sourceWindow) return sandbox;
    }
    return null;
  }

  listSandboxes() {
    return [...this.sandboxes.values()].map((sandbox) => ({
      id: sandbox.id,
      transport: sandbox.transport,
      state: sandbox.state,
      config: sandbox.config
    }));
  }

  clear() {
    this.sandboxes.clear();
    this.events.clear();
    this.stopListening();
  }
}

const SANDBOX_BUS = new SandboxBus();
export { SANDBOX_BUS as Bus };

export class OmniSandbox {
  constructor(targetOrOptions = null, options = {}) {
    const targetIsOptions = targetOrOptions && !isIframeElement(targetOrOptions) && !targetOrOptions.postMessage;
    const resolvedOptions = targetIsOptions ? targetOrOptions : options;
    this.id = resolvedOptions.id || nextSandboxId();
    this.bus = resolvedOptions.bus || SANDBOX_BUS;
    this.target = targetIsOptions ? resolvedOptions.target || null : targetOrOptions;
    this.targetOrigin = resolvedOptions.targetOrigin || '*';
    this.transport = resolvedOptions.transport || (isIframeElement(this.target) ? 'iframe' : 'worker');
    this.config = {};
    this.state = 'created';
    this.unregister = null;
  }

  async start(options = {}) {
    this.config = options.config || {};
    if (this.transport === 'iframe') this.startIframe(options);
    if (this.transport === 'worker') this.startWorker(options);
    this.unregister = this.bus.register(this);
    this.state = 'running';
    return this;
  }

  startIframe(options = {}) {
    if (!this.target) {
      if (!canUseDom()) throw createOmniError('Sandbox', 'OmniCore.Sandbox requires an iframe target outside the DOM.');
      this.target = document.createElement('iframe');
    }
    this.target.dataset.omnicoreSandboxId = this.id;
    if (!this.target.getAttribute('sandbox')) {
      this.target.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    }
    this.target.srcdoc = options.html || createIframeBootstrap({
      id: this.id,
      config: this.config,
      moduleUrl: options.moduleUrl
    });
  }

  startWorker(options = {}) {
    if (this.target?.postMessage) return;
    const WorkerCtor = options.Worker || globalThis.Worker;
    if (!WorkerCtor) throw createOmniError('Sandbox', 'OmniCore.Sandbox worker transport requires Worker support.');
    if (!options.workerUrl) throw createOmniError('Sandbox', 'OmniCore.Sandbox worker transport requires workerUrl.');
    this.target = new WorkerCtor(options.workerUrl, options.workerOptions || {});
    this.target.onmessage = (event) => {
      const data = event.data || {};
      if (data.type !== SANDBOX_EVENT_TYPE || !data.channel) return;
      this.bus.publish(data.channel, data.payload, { source: data.source || this.id });
    };
  }

  post(channel, payload) {
    return this.bus.publish(channel, payload, {
      source: this.id,
      targetOrigin: this.targetOrigin
    });
  }

  deliver(message, targetOrigin = this.targetOrigin) {
    if (this.transport === 'iframe') {
      this.target?.contentWindow?.postMessage?.(message, targetOrigin || '*');
      return true;
    }
    this.target?.postMessage?.(message);
    return true;
  }

  destroy() {
    this.unregister?.();
    if (this.transport === 'worker') this.target?.terminate?.();
    this.unregister = null;
    this.state = 'destroyed';
  }
}

export default OmniSandbox;
