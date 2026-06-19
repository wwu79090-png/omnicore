import { createOmniError } from '../core/OmniError.js';

/**
 * Production crash reporter MVP.
 */
export class CrashReporter {
  constructor({
    endpoint = null,
    enabled = undefined,
    store = null,
    scene = null,
    metrics = null,
    fetcher = globalThis.fetch?.bind(globalThis),
    limit = 80,
    autoInstall = false,
    timeoutMs = 60000,
    env = readProcessEnv(),
    globalConfig = readGlobalTelemetryConfig(),
    device = null
  } = {}) {
    const telemetry = resolveTelemetryConfig({ endpoint, enabled, env, globalConfig });
    this.enabled = telemetry.enabled;
    this.endpoint = telemetry.endpoint;
    this.store = store;
    this.scene = scene;
    this.metrics = metrics;
    this.fetcher = fetcher;
    this.limit = limit;
    this.timeoutMs = timeoutMs;
    this.device = device;
    this.operations = [];
    this.installed = false;
    this.errorHandler = (event) => this.capture(event.error || createOmniError('CrashReporter', event.message || 'window error'));
    this.rejectionHandler = (event) => this.capture(
      event.reason instanceof Error ? event.reason : createOmniError('CrashReporter', String(event.reason))
    );
    if (autoInstall) this.install();
  }

  static resolveTelemetryConfig(options = {}) {
    return resolveTelemetryConfig(options);
  }

  install() {
    if (!this.enabled || this.installed || typeof window === 'undefined') return this;
    window.addEventListener('error', this.errorHandler);
    window.addEventListener('unhandledrejection', this.rejectionHandler);
    this.installed = true;
    return this;
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', this.errorHandler);
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
    }
    this.installed = false;
  }

  recordOperation(operation) {
    this.operations.push({ ...operation });
    if (this.operations.length > this.limit) this.operations.shift();
  }

  async capture(error) {
    const payload = this.createPayload(error);
    if (!this.enabled || !this.endpoint || !this.fetcher) return payload;

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
    try {
      await this.fetcher(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller?.signal
      });
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    return payload;
  }

  createPayload(error) {
    return {
      at: new Date().toISOString(),
      error: {
        name: error?.name || 'Error',
        message: error?.message || String(error),
        stack: error?.stack || ''
      },
      store: safeJson(this.store?.snapshot?.() || {}),
      scene: readScene(this.scene),
      metrics: safeJson(this.metrics?.snapshot?.() || this.metrics?.export?.() || {}),
      memory: readMemory(),
      device: readDevice(this.device),
      operations: [...this.operations],
      userAgent: readDevice(this.device).userAgent
    };
  }
}

export function resolveTelemetryConfig({
  endpoint = null,
  enabled = undefined,
  env = readProcessEnv(),
  globalConfig = readGlobalTelemetryConfig()
} = {}) {
  const configuredEndpoint = endpoint
    || globalConfig?.endpoint
    || globalConfig?.webhookUrl
    || env.OMNICORE_CRASH_WEBHOOK
    || env.OMNICORE_TELEMETRY_WEBHOOK
    || env.OMNICORE_CRASH_REPORT_URL
    || null;
  const configuredEnabled = enabled ?? globalConfig?.enabled ?? parseBoolean(env.OMNICORE_TELEMETRY_ENABLED);

  return {
    endpoint: configuredEndpoint,
    enabled: Boolean(configuredEnabled || configuredEndpoint)
  };
}

function readScene(scene) {
  if (!scene) return null;
  if (typeof scene === 'string') return { name: scene };
  const current = scene.current || scene.currentScene || scene.active || scene;
  return {
    name: current?.name || current?.id || null
  };
}

function readDevice(override = null) {
  if (override) return { ...override };
  const nav = globalThis.navigator || {};
  return {
    userAgent: nav.userAgent || '',
    platform: nav.platform || '',
    deviceMemory: nav.deviceMemory || null,
    language: nav.language || '',
    hardwareConcurrency: nav.hardwareConcurrency || null
  };
}

function readMemory() {
  const memory = globalThis.performance?.memory;
  if (!memory) return null;
  return {
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    totalJSHeapSize: memory.totalJSHeapSize,
    usedJSHeapSize: memory.usedJSHeapSize
  };
}

function safeJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { serializationError: true };
  }
}

function readGlobalTelemetryConfig() {
  return globalThis.window?.__OMNICORE_TELEMETRY__ || globalThis.__OMNICORE_TELEMETRY__ || {};
}

function readProcessEnv() {
  return globalThis.process?.env || {};
}

function parseBoolean(value) {
  if (value == null) return undefined;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export default CrashReporter;
