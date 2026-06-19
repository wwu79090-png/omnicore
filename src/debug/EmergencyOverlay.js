/**
 * Debug-only fatal error and warning overlay.
 */
export class EmergencyOverlay {
  constructor({ events = null, container = null } = {}) {
    this.events = events;
    this.container = container;
    this.root = null;
    this.message = null;
    this.unsubscribers = [];
  }

  attach() {
    if (!this.events?.on) return this;
    this.unsubscribers.push(
      this.events.on('error', (payload) => this.show(payload, 'error')),
      this.events.on('engine:error', (payload) => this.show(payload, 'error')),
      this.events.on('warning', (payload) => this.show(payload, 'warning')),
      this.events.on('engine:warning', (payload) => this.show(payload, 'warning')),
      this.events.on('loader:error', (payload) => this.show(payload, 'error'))
    );
    return this;
  }

  detach() {
    for (const unsubscribe of this.unsubscribers) unsubscribe?.();
    this.unsubscribers.length = 0;
    this.destroy();
  }

  show(payload, level = 'error') {
    this._ensureRoot();
    if (!this.root) return;
    this.message.textContent = formatEmergencyMessage(payload, level);
    this.root.style.display = 'flex';
  }

  hide() {
    if (this.root) this.root.style.display = 'none';
  }

  destroy() {
    this.root?.remove?.();
    this.root = null;
    this.message = null;
  }

  _ensureRoot() {
    if (this.root || typeof document === 'undefined' || !document.createElement) return;
    const root = document.createElement('div');
    const panel = document.createElement('div');
    const message = document.createElement('pre');
    const actions = document.createElement('div');
    const continueButton = document.createElement('button');
    const closeButton = document.createElement('button');

    root.dataset.omnicoreEmergency = 'true';
    Object.assign(root.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.58)',
      pointerEvents: 'auto'
    });

    Object.assign(panel.style, {
      width: 'min(720px, calc(100vw - 32px))',
      maxHeight: 'calc(100vh - 32px)',
      overflow: 'auto',
      background: 'rgba(24, 0, 0, 0.94)',
      border: '1px solid rgba(255,80,80,0.95)',
      borderRadius: '6px',
      padding: '18px',
      boxShadow: '0 0 28px rgba(255,0,0,0.4)'
    });

    Object.assign(message.style, {
      margin: '0 0 16px',
      color: '#ff5a5f',
      whiteSpace: 'pre-wrap',
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '14px',
      lineHeight: '1.55',
      letterSpacing: '0'
    });

    Object.assign(actions.style, {
      display: 'flex',
      gap: '8px',
      justifyContent: 'flex-end'
    });

    continueButton.type = 'button';
    continueButton.dataset.action = 'continue';
    continueButton.textContent = '继续运行';
    closeButton.type = 'button';
    closeButton.dataset.action = 'close';
    closeButton.textContent = '关闭';
    [continueButton, closeButton].forEach((button) => {
      Object.assign(button.style, {
        border: '1px solid rgba(255,255,255,0.28)',
        borderRadius: '4px',
        background: 'rgba(255,255,255,0.12)',
        color: '#ffffff',
        padding: '6px 12px',
        cursor: 'pointer',
        fontFamily: 'inherit'
      });
    });

    continueButton.addEventListener('click', () => this.hide());
    closeButton.addEventListener('click', () => this.destroy());

    actions.appendChild(continueButton);
    actions.appendChild(closeButton);
    panel.appendChild(message);
    panel.appendChild(actions);
    root.appendChild(panel);
    (this.container || document.body).appendChild(root);

    this.root = root;
    this.message = message;
  }
}

export function formatEmergencyMessage(payload, level = 'error') {
  const normalized = normalizePayload(payload);
  const title = level === 'warning' ? 'OmniCore 警告' : 'OmniCore 致命错误';
  const line = Number(normalized.line || 0);
  const lineText = line > 0 ? `第${line}行` : '行号未知';
  return `[${title}] ${lineText}：${normalized.message}`;
}

function normalizePayload(payload) {
  if (payload instanceof Error) {
    return {
      message: payload.message,
      line: parseStackLine(payload.stack)
    };
  }

  if (typeof payload === 'string') {
    return {
      message: payload,
      line: 0
    };
  }

  return {
    message: payload?.message || payload?.friendlyMessage || '未知错误。',
    line: payload?.line || parseStackLine(payload?.stack || payload?.cause?.stack || '')
  };
}

function parseStackLine(stack = '') {
  const match = String(stack).match(/:(\d+):\d+\)?(?:\n|$)/);
  return match ? Number(match[1]) : 0;
}

export default EmergencyOverlay;
