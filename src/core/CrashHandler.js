import { createOmniError } from './OmniError.js';
import { createReproductionBundle } from '../debug/ReproductionBundle.js';

function readScene(game, scene) {
  const current = readCurrentScene(game, scene);
  return {
    name: current?.name || current?.id || null,
    entityCount: Array.isArray(current?.entities) ? current.entities.length : undefined
  };
}

function readCurrentScene(game, scene) {
  const target = scene || game?.scene;
  return target?.current || target?.currentScene || target?.active || target;
}

function snapshotStore(store) {
  const value = store?.snapshot?.() || store?.toJSON?.() || {};
  return safeClone(value);
}

function snapshotMetrics(metrics) {
  return safeClone(metrics?.snapshot?.() || metrics?.export?.() || {});
}

function readRuntime() {
  const nav = globalThis.navigator || {};
  const perf = globalThis.performance || {};
  return {
    href: globalThis.location?.href || '',
    userAgent: nav.userAgent || '',
    language: nav.language || '',
    platform: nav.platform || '',
    deviceMemory: nav.deviceMemory || null,
    hardwareConcurrency: nav.hardwareConcurrency || null,
    memory: perf.memory ? {
      jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
      totalJSHeapSize: perf.memory.totalJSHeapSize,
      usedJSHeapSize: perf.memory.usedJSHeapSize
    } : null
  };
}

function safeClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { serializationError: true };
  }
}

function normalizeError(error) {
  if (error instanceof Error) return error;
  return createOmniError('Crash', typeof error === 'string' ? error : JSON.stringify(error));
}

export class CrashHandler {
  constructor({
    game = null,
    store = null,
    scene = null,
    metrics = null,
    onReport = null,
    autoInstall = false,
    target = globalThis
  } = {}) {
    this.game = game;
    this.store = store || game?.store || null;
    this.scene = scene || game?.scene || null;
    this.metrics = metrics || game?.metrics || game?.performance || null;
    this.onReport = onReport;
    this.target = target;
    this.reports = [];
    this.reproductionBundles = [];
    this.installed = false;
    this.errorHandler = (event) => this.capture(event.error || event.message || 'window error', { source: 'error' });
    this.rejectionHandler = (event) => this.capture(event.reason || 'unhandled rejection', { source: 'unhandledrejection' });
    if (autoInstall) this.install();
  }

  install(target = this.target) {
    if (!target?.addEventListener || this.installed) return this;
    this.target = target;
    target.addEventListener('error', this.errorHandler);
    target.addEventListener('unhandledrejection', this.rejectionHandler);
    this.installed = true;
    return this;
  }

  uninstall() {
    if (!this.target?.removeEventListener || !this.installed) return this;
    this.target.removeEventListener('error', this.errorHandler);
    this.target.removeEventListener('unhandledrejection', this.rejectionHandler);
    this.installed = false;
    return this;
  }

  capture(error, context = {}) {
    const normalized = normalizeError(error);
    const report = {
      id: `crash_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      error: {
        name: normalized.name || 'Error',
        message: normalized.message || String(normalized),
        stack: normalized.stack || ''
      },
      context: safeClone(context),
      runtime: readRuntime(),
      game: {
        debug: Boolean(this.game?.config?.debug),
        renderer: this.game?.config?.renderer || null,
        paused: Boolean(this.game?.paused)
      },
      scene: readScene(this.game, this.scene),
      store: snapshotStore(this.store),
      metrics: snapshotMetrics(this.metrics)
    };
    this.reports.push(report);
    this.onReport?.(report);
    return report;
  }

  captureReproduction(error, context = {}, options = {}) {
    const report = this.capture(error, context);
    return this.createReproductionBundle(report, options);
  }

  createReproductionBundle(report = this.latest(), options = {}) {
    const scene = options.scene || readCurrentScene(this.game, this.scene);
    const bundle = createReproductionBundle({
      crash: report,
      scene,
      assetManifest: options.assetManifest || this.game?.assetManifest || this.game?.assets?.manifest || {},
      inputs: options.inputs || this.game?.input?.history || this.game?.input?.sequence?.buffer || [],
      renderQueue: options.renderQueue || null,
      store: options.store || report?.store || snapshotStore(this.store),
      metrics: options.metrics || report?.metrics || snapshotMetrics(this.metrics),
      generatedAt: options.generatedAt
    });
    this.reproductionBundles.push(bundle);
    return bundle;
  }

  latest() {
    return this.reports.at(-1) || null;
  }

  latestReproduction() {
    return this.reproductionBundles.at(-1) || null;
  }
}

export default CrashHandler;
