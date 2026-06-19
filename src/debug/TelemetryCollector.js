import { DEFAULT_DEBUG } from '../config/defaults.js';

const TELEMETRY_WRAPPED = Symbol('omnicoreTelemetryWrapped');

function defaultClock() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function resolveConfigPath(configPath, args) {
  if (typeof configPath === 'function') return configPath(...args);
  return configPath || null;
}

/**
 * Debug-only API telemetry collector.
 */
export class TelemetryCollector {
  constructor({
    debug = DEFAULT_DEBUG,
    limit = 240,
    clock = defaultClock
  } = {}) {
    this.debug = debug;
    this.limit = limit;
    this.clock = clock;
    this.apiUsage = new Map();
    this.errors = [];
    this.trends = [];
  }

  recordApi(name, {
    duration = 0,
    configPath = null,
    meta = {}
  } = {}) {
    if (!this.debug || !name) return null;
    const current = this.apiUsage.get(name) || {
      name,
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      maxDuration: 0,
      lastDuration: 0,
      lastAt: 0,
      configPaths: {}
    };
    const safeDuration = Number.isFinite(duration) ? duration : 0;
    current.count += 1;
    current.totalDuration += safeDuration;
    current.avgDuration = Number((current.totalDuration / current.count).toFixed(3));
    current.maxDuration = Math.max(current.maxDuration, safeDuration);
    current.lastDuration = Number(safeDuration.toFixed(3));
    current.lastAt = Date.now();
    if (configPath) current.configPaths[configPath] = (current.configPaths[configPath] || 0) + 1;
    if (Object.keys(meta).length) current.meta = { ...(current.meta || {}), ...meta };
    this.apiUsage.set(name, current);
    this._pushTrend({ type: 'api', name, duration: safeDuration, at: current.lastAt });
    return { ...current, configPaths: { ...current.configPaths } };
  }

  recordError(name, error, { configPath = null, meta = {} } = {}) {
    if (!this.debug) return null;
    const entry = {
      api: name || 'unknown',
      message: error?.message || String(error || '未知错误'),
      configPath,
      at: Date.now(),
      ...meta
    };
    this.errors.push(entry);
    if (this.errors.length > this.limit) this.errors.shift();
    this._pushTrend({ type: 'error', name: entry.api, at: entry.at });
    return entry;
  }

  recordTrend(name, value, meta = {}) {
    if (!this.debug) return null;
    const entry = {
      type: 'trend',
      name,
      value,
      at: Date.now(),
      ...meta
    };
    this._pushTrend(entry);
    return entry;
  }

  wrapMethod(target, methodName, apiName = methodName, options = {}) {
    if (!this.debug || !target || typeof target[methodName] !== 'function') return () => {};
    const original = target[methodName];
    if (original[TELEMETRY_WRAPPED]) return () => {};
    const collector = this;
    function wrapped(...args) {
      const start = collector.clock();
      const configPath = resolveConfigPath(options.configPath, args);
      try {
        const result = original.apply(this, args);
        if (result && typeof result.then === 'function') {
          return result.then(
            (value) => {
              collector.recordApi(apiName, {
                duration: collector.clock() - start,
                configPath
              });
              return value;
            },
            (error) => {
              collector.recordError(apiName, error, { configPath });
              throw error;
            }
          );
        }
        collector.recordApi(apiName, {
          duration: collector.clock() - start,
          configPath
        });
        return result;
      } catch (error) {
        collector.recordError(apiName, error, { configPath });
        throw error;
      }
    }
    Object.defineProperty(wrapped, TELEMETRY_WRAPPED, { value: true });
    Object.defineProperty(wrapped, '__omnicoreTelemetryOriginal', { value: original });
    target[methodName] = wrapped;
    return () => {
      if (target[methodName] === wrapped) target[methodName] = original;
    };
  }

  snapshot() {
    const apiUsage = {};
    for (const [name, value] of this.apiUsage) {
      apiUsage[name] = {
        ...value,
        configPaths: { ...value.configPaths }
      };
    }
    return {
      apiUsage,
      errors: this.errors.map((entry) => ({ ...entry })),
      trends: this.trends.map((entry) => ({ ...entry }))
    };
  }

  exportInsights() {
    const snapshot = this.snapshot();
    const apiUsage = Object.fromEntries(
      Object.entries(snapshot.apiUsage)
        .sort(([, left], [, right]) => right.count - left.count)
    );
    return {
      ...snapshot,
      apiUsage,
      tutorialGaps: Object.keys(apiUsage)
    };
  }

  clear() {
    this.apiUsage.clear();
    this.errors.length = 0;
    this.trends.length = 0;
  }

  _pushTrend(entry) {
    this.trends.push(entry);
    if (this.trends.length > this.limit) this.trends.shift();
  }
}

export default TelemetryCollector;
