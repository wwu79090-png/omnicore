/**
 * Lightweight runtime performance metric collector.
 *
 * Core paths can call `measure(name, fn)` or `record(name, duration)` and the
 * collected data can be exported as JSON for CI or remote debugging.
 *
 * @example
 * const metrics = new PerformanceMetrics({ enabled: true });
 * metrics.measure('renderer.renderScene', () => renderer.renderScene(scene));
 */
export class PerformanceMetrics {
  constructor({ enabled = true, limit = 240, clock = defaultClock } = {}) {
    this.enabled = enabled;
    this.limit = limit;
    this.clock = clock;
    this.buckets = new Map();
  }

  /**
   * @param {string} name Metric name.
   * @param {Function} fn Work to measure.
   * @returns {*} Function return value.
   */
  measure(name, fn) {
    if (!this.enabled) return fn();
    const start = this.clock();
    try {
      return fn();
    } finally {
      this.record(name, this.clock() - start);
    }
  }

  /**
   * @param {string} name Metric name.
   * @param {number} duration Duration in milliseconds.
   * @param {Record<string, *>} meta Extra metric metadata.
   * @returns {object} Recorded metric.
   */
  record(name, duration, meta = {}) {
    if (!this.enabled || !Number.isFinite(duration)) return null;
    const bucket = this._bucket(name);
    const entry = {
      name,
      duration: Number(duration.toFixed(3)),
      at: Date.now(),
      ...meta
    };
    bucket.push(entry);
    if (bucket.length > this.limit) bucket.shift();
    return entry;
  }

  /**
   * @returns {Record<string, object[]>} Snapshot grouped by subsystem.
   */
  export() {
    const result = {};
    for (const [name, entries] of this.buckets) {
      const group = name.split('.')[0] || 'runtime';
      if (!result[group]) result[group] = [];
      result[group].push(...entries);
    }
    return result;
  }

  /**
   * @returns {string} JSON string for tooling ingestion.
   */
  exportJSON() {
    return JSON.stringify(this.export(), null, 2);
  }

  /**
   * @returns {void}
   */
  clear() {
    this.buckets.clear();
  }

  _bucket(name) {
    if (!this.buckets.has(name)) this.buckets.set(name, []);
    return this.buckets.get(name);
  }
}

function defaultClock() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export default PerformanceMetrics;
