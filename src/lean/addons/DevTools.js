/**
 * Development tools addon: tilde console, live inspector, performance panel,
 * and remote log forwarding hook.
 */
export class DevToolsAddon {
  constructor({ enabled = false } = {}) {
    this.enabled = enabled;
    this.panel = null;
    this.consolePanel = null;
  }

  mount(bootstrap, options = {}) {
    this.enabled = options.enabled ?? bootstrap.debug ?? this.enabled;
    if (!this.enabled || !bootstrap.document?.createElement) return this;
    this.bootstrap = bootstrap;
    this._mountPerformancePanel(bootstrap.document);
    this._bindConsoleToggle();
    return this;
  }

  logForwarder(url) {
    if (!url || typeof WebSocket === 'undefined') return null;
    this.socket = new WebSocket(url);
    return this.socket;
  }

  inspectTree(root = this.bootstrap?.addons?.scene?.current?.()) {
    if (!this.panel || !root) return;
    const children = root.children || [];
    this.panel.textContent = `FPS ${this.fps || 0} | objects ${children.length}`;
  }

  unmount() {
    this.panel?.remove?.();
    this.consolePanel?.remove?.();
    globalThis.window?.removeEventListener?.('keydown', this.boundToggle);
    this.socket?.close?.();
  }

  _mountPerformancePanel(documentRef) {
    this.panel = documentRef.createElement('div');
    this.panel.textContent = 'FPS 0 | objects 0';
    Object.assign(this.panel.style, {
      position: 'fixed',
      right: '8px',
      top: '8px',
      padding: '6px 8px',
      color: '#e2e8f0',
      background: 'rgba(15,23,42,0.76)',
      font: '12px monospace',
      zIndex: '2147483646'
    });
    documentRef.body?.appendChild?.(this.panel);
  }

  _bindConsoleToggle() {
    this.boundToggle = (event) => {
      if (event.key === '`' || event.key === '~') this.toggleConsole();
    };
    globalThis.window?.addEventListener?.('keydown', this.boundToggle);
  }

  toggleConsole() {
    if (this.consolePanel) {
      this.consolePanel.remove();
      this.consolePanel = null;
      return;
    }
    this.consolePanel = this.bootstrap.document.createElement('div');
    this.consolePanel.textContent = 'OmniCore.Console';
    Object.assign(this.consolePanel.style, {
      position: 'fixed',
      left: '12px',
      bottom: '12px',
      width: '320px',
      height: '160px',
      background: 'rgba(2,6,23,0.9)',
      color: '#e2e8f0',
      border: '1px solid #38bdf8',
      zIndex: '2147483647',
      font: '12px monospace'
    });
    this.bootstrap.document.body?.appendChild?.(this.consolePanel);
  }
}

export default DevToolsAddon;
