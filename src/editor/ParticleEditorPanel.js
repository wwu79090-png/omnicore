/**
 * Debug-only particle parameter editor.
 */
export class ParticleEditorPanel {
  constructor({ debug = false, initial = {} } = {}) {
    this.debug = debug;
    this.params = {
      ...initial
    };
    this.element = null;
  }

  attach(parent = document.body) {
    if (!this.debug || typeof document === 'undefined') return this;
    this.detach();
    const panel = document.createElement('section');
    panel.dataset.omnicoreParticleEditor = 'true';
    panel.setAttribute('data-omnicore-particle-editor', 'true');
    panel.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;background:#111827;color:#f8fafc;padding:10px;font:12px system-ui';
    panel.innerHTML = Object.entries(this.params)
      .map(([key, value]) => `<label style="display:block;margin:4px 0">${key}<input data-particle-param="${key}" value="${value}" /></label>`)
      .join('');
    panel.addEventListener('input', (event) => {
      const key = event.target?.dataset?.particleParam;
      if (key) this.updateParam(key, coerceValue(event.target.value));
    });
    parent.appendChild(panel);
    this.element = panel;
    return this;
  }

  detach() {
    this.element?.remove?.();
    this.element = null;
  }

  updateParam(key, value) {
    this.params[key] = value;
    const input = this.element?.querySelector?.(`[data-particle-param="${key}"]`);
    if (input && String(input.value) !== String(value)) input.value = value;
    return this.params;
  }

  exportJSON() {
    return { ...this.params };
  }
}

function coerceValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && String(value).trim() !== '' ? number : value;
}

export default ParticleEditorPanel;
