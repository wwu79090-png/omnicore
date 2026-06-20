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
    clock = defaultClock,
    anonymous = false,
    engineVersion = 'unknown',
    runtime = false,
    intervalMs = 15000,
    endpoint = null,
    fetcher = globalThis.fetch?.bind(globalThis),
    transport = null
  } = {}) {
    this.debug = debug;
    this.limit = limit;
    this.clock = clock;
    this.anonymous = anonymous === true;
    this.engineVersion = engineVersion;
    this.runtime = runtime === true;
    this.intervalMs = Math.max(0, Number(intervalMs) || 0);
    this.endpoint = endpoint;
    this.fetcher = fetcher;
    this.transport = transport;
    this.apiUsage = new Map();
    this.errors = [];
    this.trends = [];
    this.runtimeSamples = [];
    this.runtimeTimer = null;
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
    if (!this.debug && !this.runtime && !this.anonymous) return null;
    const entry = {
      api: name || 'unknown',
      message: error?.message || String(error || '未知错误'),
      errorType: error?.name || 'Error',
      configPath,
      at: Date.now(),
      ...meta
    };
    this.errors.push(entry);
    if (this.errors.length > this.limit) this.errors.shift();
    this._pushTrend({ type: 'error', name: entry.api, at: entry.at });
    return entry;
  }

  captureRuntimeSample(game = {}) {
    if (!this.runtime && !this.anonymous) return null;
    const sample = {
      at: Date.now(),
      fps: resolveFps(game),
      memoryMB: resolveMemoryMB(),
      renderer: game.renderer?.backend || (game.headless ? 'headless' : 'unknown'),
      scene: game.scene?.current?.name || null,
      webgl: {
        lost: Boolean(game.webglContext?.lost),
        backend: game.renderer?.backend || null
      },
      errorCount: this.errors.length
    };
    this.runtimeSamples.push(sample);
    if (this.runtimeSamples.length > this.limit) this.runtimeSamples.shift();
    this._pushTrend({ type: 'runtime', name: 'runtime.sample', value: sample.fps, at: sample.at });
    return { ...sample, webgl: { ...sample.webgl } };
  }

  startRuntime(game) {
    if (!this.runtime) return this;
    if (this.intervalMs > 0 && this.runtimeTimer == null) {
      this.captureRuntimeSample(game);
      this.runtimeTimer = setInterval(() => {
        this.captureRuntimeSample(game);
        Promise.resolve(this.flushRuntimeSummary()).catch((error) => {
          this.recordError('Telemetry.flush', error);
        });
      }, this.intervalMs);
    }
    return this;
  }

  stopRuntime() {
    if (this.runtimeTimer != null) {
      clearInterval(this.runtimeTimer);
      this.runtimeTimer = null;
    }
    return this;
  }

  async flushRuntimeSummary(summary = this.exportRuntimeHealthSummary()) {
    if (!summary) return null;
    if (typeof this.transport === 'function') return this.transport(summary);
    if (!this.endpoint || !this.fetcher) return null;
    return this.fetcher(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(summary)
    });
  }

  exportRuntimeHealthSummary() {
    if (!this.anonymous) return null;
    const latest = this.runtimeSamples[this.runtimeSamples.length - 1] || null;
    const fpsValues = this.runtimeSamples
      .map((sample) => Number(sample.fps))
      .filter((value) => Number.isFinite(value) && value > 0);
    return {
      schema: 'omnicore.runtime-health.v1',
      anonymous: true,
      engineVersion: this.engineVersion,
      samples: this.runtimeSamples.length,
      avgFps: fpsValues.length ? Number((fpsValues.reduce((sum, value) => sum + value, 0) / fpsValues.length).toFixed(2)) : null,
      latest: latest ? {
        ...latest,
        webgl: { ...latest.webgl }
      } : null,
      errorTypes: this._errorTypeCounts()
    };
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

  exportAnonymousSummary() {
    if (!this.anonymous) return null;
    const apiUsage = {};
    for (const [name, value] of this.apiUsage) {
      apiUsage[name] = value.count;
    }
    const summary = {
      schema: 'omnicore.anonymous-telemetry.v1',
      anonymous: true,
      engineVersion: this.engineVersion,
      apiUsage,
      errorTypes: this._errorTypeCounts(),
      samples: Object.values(apiUsage).reduce((total, count) => total + count, 0) + this.errors.length
    };
    if (this.runtimeSamples.length) {
      summary.runtime = this.exportRuntimeHealthSummary();
      summary.samples += this.runtimeSamples.length;
    }
    return summary;
  }

  clear() {
    this.apiUsage.clear();
    this.errors.length = 0;
    this.trends.length = 0;
    this.runtimeSamples.length = 0;
  }

  _pushTrend(entry) {
    this.trends.push(entry);
    if (this.trends.length > this.limit) this.trends.shift();
  }

  _errorTypeCounts() {
    const errorTypes = {};
    for (const entry of this.errors) {
      const type = entry.errorType || 'Error';
      errorTypes[type] = (errorTypes[type] || 0) + 1;
    }
    return errorTypes;
  }
}

function resolveFps(game) {
  const value = game.store?.get?.('fps')
    ?? game.performanceMonitor?.current?.fps
    ?? game.metrics?.current?.fps
    ?? 0;
  const fps = Number(value);
  return Number.isFinite(fps) ? fps : 0;
}

function resolveMemoryMB() {
  const memory = globalThis.performance?.memory;
  const bytes = memory?.usedJSHeapSize ?? (typeof process !== 'undefined' ? process.memoryUsage?.().heapUsed : 0);
  const numeric = Number(bytes) || 0;
  return Number((numeric / (1024 * 1024)).toFixed(2));
}

export default TelemetryCollector;
