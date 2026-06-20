/**
 * Browser GC and allocation-pressure diagnostics for the fixed-step loop.
 */
export class MemoryGuardian {
  constructor({
    debug = false,
    minorGcThresholdMs = 4,
    heapDropThresholdBytes = 512 * 1024,
    performanceApi = globalThis.performance,
    observerFactory = globalThis.PerformanceObserver,
    logger = console,
    onGC = null
  } = {}) {
    this.debug = debug;
    this.minorGcThresholdMs = minorGcThresholdMs;
    this.heapDropThresholdBytes = heapDropThresholdBytes;
    this.performance = performanceApi;
    this.observerFactory = observerFactory;
    this.logger = logger;
    this.onGC = onGC;
    this.observer = null;
    this.pendingEntries = [];
    this.lastHeapSize = this._readHeapSize();
  }

  start() {
    if (this.observer || typeof this.observerFactory !== 'function') return this;
    const supported = this.observerFactory.supportedEntryTypes || [];
    if (supported.length && !supported.includes('gc')) return this;
    try {
      const ObserverFactory = this.observerFactory;
      this.observer = new ObserverFactory((list) => {
        this.pendingEntries.push(...list.getEntries());
      });
      this.observer.observe({ entryTypes: ['gc'] });
    } catch {
      this.observer = null;
    }
    return this;
  }

  stop() {
    this.observer?.disconnect?.();
    this.observer = null;
  }

  watchFrame({
    frame = 0,
    updateMs = 0,
    frameMs = 16.7,
    time = 0
  } = {}) {
    const reports = [];
    while (this.pendingEntries.length) {
      const entry = this.pendingEntries.shift();
      reports.push(this.recordGC({
        kind: normalizeGcKind(entry.kind || entry.name),
        duration: Number(entry.duration) || 0,
        frame,
        source: 'PerformanceObserver',
        time
      }));
    }

    const heapSize = this._readHeapSize();
    if (Number.isFinite(heapSize) && Number.isFinite(this.lastHeapSize)) {
      const deltaHeap = heapSize - this.lastHeapSize;
      if (deltaHeap < -this.heapDropThresholdBytes && updateMs > frameMs) {
        reports.push(this.recordGC({
          kind: 'minor',
          duration: updateMs,
          frame,
          source: 'heap-drop',
          deltaHeap,
          time
        }));
      }
    }
    this.lastHeapSize = heapSize;
    return reports;
  }

  recordGC({
    kind = 'unknown',
    duration = 0,
    frame = 0,
    source = 'manual',
    deltaHeap = 0,
    time = 0
  } = {}) {
    const report = {
      type: 'memory:gc',
      kind,
      duration,
      frame,
      source,
      deltaHeap,
      time,
      suggestions: buildSuggestions(kind, duration)
    };
    if (this.debug || duration >= this.minorGcThresholdMs) {
      this.logger?.warn?.('[OmniCore] MemoryGuardian detected GC pressure.', report);
    }
    this.onGC?.(report);
    return report;
  }

  _readHeapSize() {
    const value = this.performance?.memory?.usedJSHeapSize;
    return Number.isFinite(value) ? value : null;
  }
}

function normalizeGcKind(kind) {
  if (kind === 1 || /minor/iu.test(String(kind))) return 'minor';
  if (kind === 2 || /major/iu.test(String(kind))) return 'major';
  if (kind === 4 || /incremental/iu.test(String(kind))) return 'incremental';
  return String(kind || 'unknown');
}

function buildSuggestions(kind, duration) {
  const suggestions = [
    'Avoid per-frame allocations in Scene.update, AI ticks, and renderer command generation.',
    'EventBus callbacks should reuse function handles instead of creating closures each frame.',
    'Move bursty logic into LogicWorker and write render-only values through SharedArrayBuffer.'
  ];
  if (kind === 'minor') suggestions.unshift(`Minor GC cost ${duration}ms; inspect short-lived arrays, Promise chains, and anonymous callbacks.`);
  return suggestions;
}

export default MemoryGuardian;
