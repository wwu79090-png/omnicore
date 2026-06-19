export class ProfilerWaterfallPanel {
  constructor({
    debug = true,
    container = null,
    maxBarWidth = 180,
    warnMs = 4
  } = {}) {
    this.debug = debug;
    this.container = container;
    this.maxBarWidth = maxBarWidth;
    this.warnMs = warnMs;
    this.panel = null;
  }

  attach(container = this.container) {
    if (!this.debug || typeof document === 'undefined') return this;
    this.container = container || document.body;
    if (this.panel) return this;
    this.panel = document.createElement('section');
    this.panel.dataset.omnicoreProfiler = 'true';
    Object.assign(this.panel.style, {
      position: 'fixed',
      right: '8px',
      bottom: '8px',
      width: '340px',
      maxHeight: '42vh',
      overflow: 'auto',
      zIndex: '2147483646',
      padding: '10px',
      color: '#e5e7eb',
      background: 'rgba(17, 24, 39, 0.9)',
      border: '1px solid rgba(148, 163, 184, 0.45)',
      borderRadius: '4px',
      font: '12px/1.45 monospace',
      pointerEvents: 'auto'
    });
    this.container.appendChild(this.panel);
    return this;
  }

  refresh(frame = null) {
    if (!this.panel) return this;
    this.panel.textContent = '';
    const title = document.createElement('strong');
    title.textContent = frame ? `Frame ${frame.frame} ${Number(frame.totalMs || 0).toFixed(2)}ms` : 'Frame profiler';
    this.panel.appendChild(title);
    if (!frame?.sections?.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No profiler samples';
      this.panel.appendChild(empty);
      return this;
    }
    const max = Math.max(1, ...frame.sections.map((section) => section.duration || 0));
    for (const section of frame.sections) {
      this.panel.appendChild(this._row(section, max));
    }
    return this;
  }

  detach() {
    this.panel?.remove?.();
    this.panel = null;
    return this;
  }

  _row(section, max) {
    const row = document.createElement('div');
    row.dataset.profilerSection = section.name;
    Object.assign(row.style, {
      display: 'grid',
      gridTemplateColumns: '132px 1fr 56px',
      gap: '6px',
      alignItems: 'center',
      marginTop: '4px'
    });
    const name = document.createElement('span');
    name.textContent = section.name;
    const bar = document.createElement('b');
    const width = Math.max(4, Math.round((section.duration / max) * this.maxBarWidth));
    Object.assign(bar.style, {
      display: 'inline-block',
      width: `${width}px`,
      height: '8px',
      background: section.duration >= this.warnMs ? '#f97316' : '#38bdf8'
    });
    const value = document.createElement('span');
    value.textContent = `${Number(section.duration || 0).toFixed(2)}ms`;
    row.append(name, bar, value);
    return row;
  }
}

export default ProfilerWaterfallPanel;
