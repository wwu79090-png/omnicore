/**
 * DOM transition barrier placed above the game canvas.
 */
export class TransitionLayer {
  constructor({ container = null, zIndex = 2147483647, text = '正在编译世界...' } = {}) {
    this.container = container;
    this.zIndex = zIndex;
    this.text = text;
    this.root = null;
    this.textElement = null;
    this.hideTimer = null;
    this._create();
  }

  show(message = this.text) {
    if (!this.root) return;
    clearTimeout(this.hideTimer);
    this.textElement.textContent = message;
    this.root.style.display = 'grid';
    this.root.style.opacity = '1';
    this.root.setAttribute('aria-hidden', 'false');
  }

  hide({ fadeMs = 200 } = {}) {
    if (!this.root) return;
    clearTimeout(this.hideTimer);
    this.root.style.opacity = '0';
    this.root.setAttribute('aria-hidden', 'true');
    this.hideTimer = setTimeout(() => {
      if (this.root) this.root.style.display = 'none';
    }, fadeMs);
  }

  destroy() {
    clearTimeout(this.hideTimer);
    this.root?.remove?.();
    this.root = null;
    this.textElement = null;
  }

  _create() {
    if (typeof document === 'undefined' || !document.createElement) return;
    const root = document.createElement('div');
    const halo = document.createElement('div');
    const text = document.createElement('div');

    root.dataset.omnicoreTransitionLayer = 'true';
    root.setAttribute('aria-hidden', 'true');
    Object.assign(root.style, {
      position: 'fixed',
      inset: '0',
      display: 'none',
      placeItems: 'center',
      background: 'rgba(0,0,0,0.72)',
      zIndex: String(this.zIndex),
      opacity: '0',
      pointerEvents: 'auto',
      transition: 'opacity 200ms ease',
      userSelect: 'none'
    });

    Object.assign(halo.style, {
      position: 'absolute',
      width: '280px',
      height: '280px',
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(56,189,248,0.28) 0%, rgba(56,189,248,0.08) 42%, rgba(56,189,248,0) 70%)',
      animation: 'omnicore-transition-halo 1.4s ease-in-out infinite alternate',
      filter: 'blur(1px)'
    });

    text.textContent = this.text;
    Object.assign(text.style, {
      position: 'relative',
      color: '#e0f2fe',
      fontFamily: 'monospace',
      fontSize: '18px',
      letterSpacing: '0',
      textShadow: '0 0 8px rgba(56,189,248,0.95), 0 0 24px rgba(14,165,233,0.7)'
    });

    root.appendChild(halo);
    root.appendChild(text);
    (this.container || document.body).appendChild(root);

    this.root = root;
    this.textElement = text;
  }
}

export default TransitionLayer;
