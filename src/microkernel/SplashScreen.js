/**
 * Optional startup splash screen for microkernel mode.
 *
 * @example
 * const splash = new SplashScreen({ text: 'OmniCore Booting' });
 * splash.show();
 * await splash.hide();
 */
export class SplashScreen {
  constructor({
    text = 'OmniCore MicroKernel Booting...',
    target = null,
    minDuration = 250,
    fadeDuration = 300,
    theme = '#00e5ff'
  } = {}) {
    this.text = text;
    this.target = target;
    this.minDuration = minDuration;
    this.fadeDuration = fadeDuration;
    this.theme = theme;
    this.element = null;
    this.startedAt = 0;
  }

  show() {
    if (typeof document === 'undefined') return null;
    if (this.element) return this.element;
    this.startedAt = Date.now();
    this.element = document.createElement('div');
    this.element.dataset.omnicoreSplash = 'true';
    this.element.innerHTML = this._html();
    Object.assign(this.element.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '9999',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000',
      color: this.theme,
      fontFamily: '"Courier New", monospace',
      transition: `opacity ${this.fadeDuration}ms ease`,
      opacity: '1'
    });
    (this.target || document.body).appendChild(this.element);
    return this.element;
  }

  async hide() {
    if (!this.element) return;
    const elapsed = Date.now() - this.startedAt;
    const wait = Math.max(0, this.minDuration - elapsed);
    if (wait) await delay(wait);
    this.element.style.opacity = '0';
    if (this.fadeDuration) await delay(this.fadeDuration);
    this.element?.remove?.();
    this.element = null;
  }

  destroy() {
    this.element?.remove?.();
    this.element = null;
  }

  _html() {
    return `
      <div style="position:relative;width:96px;height:96px;margin-bottom:18px;">
        <div style="position:absolute;inset:0;border:3px solid ${this.theme};border-radius:50%;box-shadow:0 0 20px ${this.theme}88;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:28px;font-weight:bold;text-shadow:0 0 12px ${this.theme};">OC</div>
      </div>
      <div style="font-size:16px;letter-spacing:1px;">${escapeHtml(this.text)}</div>
      <div style="margin-top:24px;width:180px;height:2px;background:${this.theme}33;overflow:hidden;">
        <div style="width:45%;height:100%;background:${this.theme};"></div>
      </div>
    `;
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export default SplashScreen;
