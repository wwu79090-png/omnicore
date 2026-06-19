import { DEFAULT_DEBUG } from '../config/defaults.js';

/**
 * Debug-only tutorial hint overlay for API targets.
 */
export class TutorialGuide {
  constructor({ debug = DEFAULT_DEBUG, steps = {} } = {}) {
    this.debug = debug;
    this.steps = steps;
    this.panel = null;
    this.activeTarget = null;
  }

  attach(container = typeof document !== 'undefined' ? document.body : null) {
    if (!this.debug || typeof document === 'undefined' || this.panel) return this;
    this.panel = document.createElement('aside');
    this.panel.dataset.omnicoreTutorial = 'true';
    Object.assign(this.panel.style, {
      position: 'fixed',
      left: '50%',
      bottom: '24px',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      padding: '10px 12px',
      maxWidth: '420px',
      color: '#e2e8f0',
      background: 'rgba(15,23,42,0.92)',
      border: '1px solid rgba(56,189,248,0.65)',
      borderRadius: '4px',
      font: '13px system-ui, sans-serif'
    });
    container?.appendChild?.(this.panel);
    return this;
  }

  showStep(apiName) {
    if (!this.debug || typeof document === 'undefined') return null;
    if (!this.panel) this.attach();
    if (this.activeTarget) delete this.activeTarget.dataset.omnicoreTutorialActive;
    const target = document.querySelector(`[data-omnicore-api="${apiName}"]`);
    if (target) {
      target.dataset.omnicoreTutorialActive = 'true';
      this.activeTarget = target;
    }
    const text = this.steps[apiName] || `查看 ${apiName} 的调用方式，并确认参数与生命周期顺序。`;
    if (this.panel) this.panel.textContent = `${apiName}: ${text}`;
    return { apiName, target, text };
  }

  detach() {
    if (this.activeTarget) delete this.activeTarget.dataset.omnicoreTutorialActive;
    this.activeTarget = null;
    this.panel?.remove?.();
    this.panel = null;
  }
}

export default TutorialGuide;
