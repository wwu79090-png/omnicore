/**
 * Changelog dialog displayed when the stored version differs from the runtime
 * version.
 *
 * @example
 * const dialog = new VersionDialog(game, { version: '1.0.0', changelog: '- Added demo' });
 * dialog.showIfNeeded();
 */
export class VersionDialog {
  constructor(game, {
    version = '0.0.0',
    changelog = '',
    storageKey = 'omnicore:lastVersion'
  } = {}) {
    this.game = game;
    this.version = version;
    this.changelog = changelog;
    this.storageKey = storageKey;
    this.panel = null;
  }

  showIfNeeded() {
    if (typeof document === 'undefined' || !this.version) return false;
    const previous = this._readVersion();
    if (previous === this.version) return false;
    this.show();
    this._writeVersion(this.version);
    return true;
  }

  show() {
    if (this.panel || typeof document === 'undefined') return;
    this.panel = document.createElement('div');
    this.panel.dataset.omnicoreVersionDialog = 'true';
    const lines = String(this.changelog || '版本已更新。').split('\n')
      .filter(Boolean)
      .map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s*/, ''))}</li>`)
      .join('');
    this.panel.innerHTML = `
      <section>
        <h2>OmniCore ${escapeHtml(this.version)}</h2>
        <ul>${lines || '<li>版本已更新。</li>'}</ul>
        <button type="button">确认</button>
      </section>
    `;
    Object.assign(this.panel.style, {
      position: 'fixed',
      inset: '0',
      display: 'grid',
      placeItems: 'center',
      background: 'rgba(2,6,23,0.72)',
      color: '#e2e8f0',
      zIndex: '2147483647',
      font: '14px system-ui, sans-serif'
    });
    const section = this.panel.querySelector('section');
    Object.assign(section.style, {
      width: 'min(520px, 90vw)',
      background: '#0f172a',
      border: '1px solid #38bdf8',
      padding: '18px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.35)'
    });
    this.panel.querySelector('button').addEventListener('click', () => this.detach());
    document.body.appendChild(this.panel);
  }

  detach() {
    this.panel?.remove?.();
    this.panel = null;
  }

  _readVersion() {
    try {
      return globalThis.localStorage?.getItem(this.storageKey) || null;
    } catch {
      return globalThis.__OmniCore_LastVersion || null;
    }
  }

  _writeVersion(version) {
    try {
      globalThis.localStorage?.setItem(this.storageKey, version);
    } catch {
      globalThis.__OmniCore_LastVersion = version;
    }
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

export default VersionDialog;
