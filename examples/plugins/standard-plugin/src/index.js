/**
 * Standard OmniCore third-party addon template.
 *
 * The plugin exposes init()/destroy(), listens through OmniCore.EventBus, and
 * writes shared data through OmniCore.Store-compatible instances.
 */
const standardPlugin = {
  name: 'standard',
  version: '1.0.0',
  panel: null,
  bus: null,
  store: null,
  cleanup: [],

  init(OmniCore, context = {}) {
    this.bus = context.bus || new OmniCore.EventBus();
    this.store = context.store || new OmniCore.Store({ standardPlugin: { enabled: true } });
    this.store.set?.('standardPlugin', { enabled: true, x: 0, y: 0 });
    this.panel = createPanel();
    document.body.appendChild(this.panel);

    const offTick = this.bus.on('plugin:tick', (payload = {}) => {
      this.store.set?.('standardPlugin:lastTick', payload);
    });
    const move = (event) => {
      const x = event.clientX + 14;
      const y = event.clientY + 14;
      Object.assign(this.panel.style, {
        transform: `translate(${x}px, ${y}px)`
      });
      this.store.set?.('standardPlugin', { enabled: true, x, y });
    };

    window.addEventListener('pointermove', move);
    this.cleanup.push(offTick, () => window.removeEventListener('pointermove', move));
    this.bus.emit('plugin:ready', { name: this.name, version: this.version });
    return this;
  },

  destroy() {
    this.cleanup.splice(0).forEach((dispose) => dispose?.());
    this.panel?.remove?.();
    this.panel = null;
    this.store?.set?.('standardPlugin', { enabled: false });
    return true;
  }
};

function createPanel() {
  const panel = document.createElement('div');
  panel.textContent = 'Standard Plugin';
  Object.assign(panel.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    zIndex: '2147483647',
    padding: '8px 10px',
    color: '#e2e8f0',
    background: 'rgba(15,23,42,0.82)',
    border: '1px solid #38bdf8',
    pointerEvents: 'none',
    font: '12px system-ui, sans-serif'
  });
  return panel;
}

export default standardPlugin;
