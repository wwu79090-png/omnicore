/**
 * Local feedback collection widget.
 */
export class FeedbackWidget {
  constructor(game, { storageKey = 'feedback_report.json' } = {}) {
    this.game = game;
    this.storageKey = storageKey;
    this.button = null;
  }

  attach() {
    if (typeof document === 'undefined' || this.button) return;
    this.button = document.createElement('button');
    this.button.textContent = '反馈';
    this.button.dataset.omnicoreFeedback = 'true';
    Object.assign(this.button.style, {
      position: 'fixed',
      right: '12px',
      bottom: '12px',
      zIndex: '2147483646',
      padding: '8px 10px',
      background: '#0f172a',
      color: '#e2e8f0',
      border: '1px solid #38bdf8'
    });
    this.button.addEventListener('click', () => this.open());
    document.body.appendChild(this.button);
  }

  open() {
    // eslint-disable-next-line no-alert
    const content = globalThis.prompt?.('请输入反馈内容') || '';
    if (!content.trim()) return null;
    const report = {
      content,
      scene: this.game?.scene?.current?.name || null,
      fps: this.game?.performanceMonitor?.current?.fps || null,
      level: this.game?.store?.get?.('currentLevel') || null,
      createdAt: new Date().toISOString()
    };
    try {
      globalThis.localStorage?.setItem(this.storageKey, JSON.stringify(report, null, 2));
    } catch {
      globalThis.__OmniCore_FeedbackReport = report;
    }
    this._downloadReport(report);
    return report;
  }

  detach() {
    this.button?.remove?.();
    this.button = null;
  }

  _downloadReport(report) {
    if (typeof document === 'undefined' || typeof Blob === 'undefined' || !globalThis.URL?.createObjectURL) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = globalThis.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.storageKey;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    globalThis.URL.revokeObjectURL?.(url);
  }
}

export default FeedbackWidget;
