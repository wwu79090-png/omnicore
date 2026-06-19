import { DEFAULT_DEBUG } from '../config/defaults.js';

/**
 * Debug overlay for API usage trends and heatmaps.
 */
export class TelemetryDashboard {
  constructor({
    debug = DEFAULT_DEBUG,
    collector = null,
    container = null
  } = {}) {
    this.debug = debug;
    this.collector = collector;
    this.container = container;
    this.panel = null;
  }

  attach(container = this.container) {
    if (!this.debug || typeof document === 'undefined') return this;
    this.container = container || document.body;
    if (this.panel) return this;
    this.panel = document.createElement('section');
    this.panel.dataset.omnicoreTelemetryDashboard = 'true';
    Object.assign(this.panel.style, {
      position: 'fixed',
      left: '8px',
      bottom: '8px',
      width: '320px',
      maxHeight: '42vh',
      overflow: 'auto',
      zIndex: '2147483647',
      padding: '10px',
      color: '#e2e8f0',
      background: 'rgba(15, 23, 42, 0.88)',
      border: '1px solid rgba(56,189,248,0.55)',
      borderRadius: '4px',
      font: '12px/1.45 monospace',
      pointerEvents: 'auto'
    });
    this.container.appendChild(this.panel);
    this.refresh();
    return this;
  }

  refresh() {
    if (!this.panel || !this.collector) return this;
    const snapshot = this.collector.snapshot();
    const usage = Object.values(snapshot.apiUsage)
      .sort((left, right) => right.count - left.count)
      .slice(0, 12);
    const maxCount = Math.max(1, ...usage.map((item) => item.count));
    const errorRows = snapshot.errors.slice(-4).reverse();

    this.panel.textContent = '';
    const title = document.createElement('strong');
    title.textContent = 'OmniCore Telemetry';
    this.panel.appendChild(title);

    const trend = document.createElement('div');
    trend.dataset.omnicoreTelemetryTrend = 'true';
    trend.textContent = `Trend: ${snapshot.trends.slice(-18).map((item) => (item.type === 'error' ? '!' : '|')).join('')}`;
    this.panel.appendChild(trend);

    const heatmap = document.createElement('div');
    heatmap.dataset.omnicoreTelemetryHeatmap = 'true';
    usage.forEach((item) => {
      const row = document.createElement('div');
      row.dataset.omnicoreTelemetryHeatmap = item.name;
      const width = Math.max(8, Math.round((item.count / maxCount) * 120));
      row.innerHTML = `<span>${item.name}</span> <b style="display:inline-block;width:${width}px;background:#38bdf8;height:8px"></b> ${item.count}x ${item.avgDuration.toFixed(2)}ms`;
      heatmap.appendChild(row);
    });
    this.panel.appendChild(heatmap);

    if (errorRows.length) {
      const errors = document.createElement('div');
      errors.dataset.omnicoreTelemetryErrors = 'true';
      errors.textContent = `Errors: ${errorRows.map((item) => `${item.api}@${item.configPath || 'runtime'}`).join(' | ')}`;
      this.panel.appendChild(errors);
    }
    return this;
  }

  detach() {
    this.panel?.remove?.();
    this.panel = null;
  }
}

export default TelemetryDashboard;
