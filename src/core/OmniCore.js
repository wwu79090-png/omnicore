/*!
 * OmniCore
 * Copyright (c) 2026 杀戮 (Shalu)
 * QQ: 3424636983
 * WeChat: lookkiitylou
 */
import {
  createCanvas,
  detectEnvironment,
  normalizeConfig,
  removeContainerCanvases,
  resolveContainer,
  safeInitialize
} from './Bootstrap.js';
import EventBus from './EventBus.js';
import Logger from './Logger.js';
import { Pool } from './MemoryPool.js';
import PixiRenderer from '../renderer/PixiRenderer.js';
import OffscreenCanvasRenderer from '../renderer/OffscreenCanvasRenderer.js';
import WebGPURenderer from '../renderer/WebGPURenderer.js';
import RendererManager from '../renderer/RendererManager.js';
import WebGLContextManager from '../renderer/WebGLContextManager.js';
import Loop from '../loop/Loop.js';
import SceneManager from '../scene/SceneManager.js';
import Store from '../store/Store.js';
import Loader from '../loader/Loader.js';
import AssetLoader from '../loader/AssetLoader.js';
import { DB, Database } from '../database/Database.js';
import Inspector from '../debug/Inspector.js';
import FrameProfiler from '../debug/FrameProfiler.js';
import PerformanceMonitor from '../debug/PerformanceMonitor.js';
import PerformanceMetrics from '../debug/PerformanceMetrics.js';
import ProfilerWaterfallPanel from '../debug/ProfilerWaterfallPanel.js';
import ProfilerSnapshot from '../debug/ProfilerSnapshot.js';
import RemoteDevTools from '../debug/RemoteDevTools.js';
import CrashReporter from '../debug/CrashReporter.js';
import EmergencyOverlay from '../debug/EmergencyOverlay.js';
import PlatformAdapter from '../platform/PlatformAdapter.js';
import Dimension3D from '../dimension3d/Dimension3D.js';
import AudioManager from '../audio/AudioManager.js';
import NetManager, { StorageManager } from '../net/NetManager.js';
import AuthManager from '../compliance/AuthManager.js';
import InputManager from '../input/InputManager.js';
import Camera from '../camera/Camera.js';
import Timer from '../timer/Timer.js';
import Deprecation from './Deprecation.js';
import TransitionLayer from './TransitionLayer.js';
import { createOmniError } from './OmniError.js';
import TimeGuard from './TimeGuard.js';
import Snapshot from './Snapshot.js';
import HotReload from '../hotreload/HotReload.js';
import HotfixManager from '../hotfix/HotfixManager.js';
import AIImporter from '../importer/AIImporter.js';
import PlaySession from '../editor/PlaySession.js';
import { Assert } from '../debug/Assert.js';
import WorkerManager from '../worker/WorkerManager.js';
import Analytics from '../analytics/Analytics.js';
import ABTest from '../experiments/ABTest.js';

/**
 * OmniCore.Game and core runtime composition.
 *
 * Owns WebGL/Canvas context management, automatic fallback, autoResize,
 * module wiring, debug lookup, platform adapters, and experimental renderer
 * backend switching.
 *
 * @example
 * const game = new OmniCore.Game({
 *   width: 960,
 *   height: 540,
 *   renderer: 'pixi',
 *   platform: 'web',
 *   debug: true
 * });
 * await game.init();
 * await OmniCore.Backend.switch('canvas'); // experimental
 */
class CoreContext {
  constructor(config) {
    this.config = config;
    this.canvas = null;
    this.container = null;
    this.resizeHandler = null;
  }

  init() {
    this.canvas = createCanvas(this.config.width, this.config.height, this.config.canvas);
    this.container = resolveContainer(this.config.parent || this.config.container);
    this.attachCanvas();
    return this.canvas;
  }

  attachCanvas() {
    if (this.config.autoAttach && this.container && !this.canvas.parentNode) {
      this.container.appendChild(this.canvas);
    }
  }

  recreateCanvas() {
    this.canvas = createCanvas(this.config.width, this.config.height);
    this.attachCanvas();
    return this.canvas;
  }

  detectContext(preferred = 'webgl') {
    if (preferred === 'auto') return 'auto';
    if (preferred === 'canvas') return 'canvas';
    if (preferred === 'offscreen') return 'offscreen';
    if (preferred === 'webgpu') return 'webgpu';
    try {
      const gl = this.canvas.getContext?.('webgl2') || this.canvas.getContext?.('webgl');
      return gl ? preferred : 'canvas';
    } catch {
      return 'canvas';
    }
  }

  autoResize(rendererOrGetter) {
    if (!this.config.autoResize || typeof window === 'undefined') return;
    this.resizeHandler = () => {
      const width = this.container?.clientWidth || this.config.width;
      const height = this.container?.clientHeight || this.config.height;
      const renderer = typeof rendererOrGetter === 'function' ? rendererOrGetter() : rendererOrGetter;
      renderer?.resize?.(width, height);
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  resetWebGLState() {
    try {
      const gl = this.canvas?.getContext?.('webgl') || this.canvas?.getContext?.('webgl2');
      gl?.getExtension?.('WEBGL_lose_context')?.loseContext?.();
    } catch {
      // WebGL context reset is best-effort across browsers and test runtimes.
    }
  }

  clearContainerCanvases() {
    removeContainerCanvases(this.container);
  }

  destroy() {
    if (this.resizeHandler && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this.resetWebGLState();
    if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null;
    this.container = null;
    this.resizeHandler = null;
  }
}

function isWebKitRuntime(environment = {}) {
  const userAgent = environment.raw?.navigator?.userAgent || '';
  return /Safari/i.test(userAgent) && !/(Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS)/i.test(userAgent);
}

export class BackendManager {
  constructor(game) {
    this.game = game;
    this.switching = false;
  }

  async switch(backend) {
    if (!['pixi', 'canvas', 'webgl', 'webgpu', 'offscreen', 'auto'].includes(backend)) {
      throw createOmniError('Backend', `不支持的渲染后端：${backend}`);
    }
    if (this.switching) return this.game.renderer;
    this.switching = true;
    const resolvePreference = this.game._resolveRendererPreference || ((value) => value);
    const targetBackend = backend === 'auto' ? 'auto' : resolvePreference.call(this.game, backend);

    try {
      this.game.hooks?.switchStart?.(targetBackend, this.game);
      this.game.events?.emit?.('switchStart', { backend: targetBackend, requestedBackend: backend });
      this.game.store?.set?.('switching', true);
      const wasRunning = this.game.loop?.running && !this.game.loop?.paused;
      this.game.loop?.pause?.();
      this.game.renderer?.destroy?.();
      this.game.core?.resetWebGLState?.();
      this.game.core?.clearContainerCanvases?.();
      const canvas = this.game.core?.recreateCanvas?.();
      if (canvas && this.game.input) this.game.input.bind(canvas);
      if (canvas) this.game.webglContext?.bind?.(canvas);
      this.game.renderer = targetBackend === 'auto'
        ? await this.game.rendererManager.create('auto')
        : await this.game.createRenderer(targetBackend);
      this.game.store?.injectBackend?.(this.game.renderer?.backend || targetBackend);
      this.game.renderer?.renderScene?.(this.game.scene?.current);
      this.game.store?.set?.('switching', false);
      this.game.hooks?.switchComplete?.(this.game.renderer?.backend || targetBackend, this.game);
      this.game.events?.emit?.('switchComplete', { backend: this.game.renderer?.backend || targetBackend, requestedBackend: backend });
      if (wasRunning) this.game.loop?.resume?.();
      return this.game.renderer;
    } finally {
      this.switching = false;
      this.game.store?.set?.('switching', false);
    }
  }

  async use(backend) {
    const entry = Deprecation.find('OmniCore.Backend.use');
    return Deprecation.forward({
      ...entry,
      target: () => this.switch(backend)
    });
  }
}

export const Backend = {
  game: null,
  bind(game) {
    this.game = game;
    return this;
  },
  async switch(backend) {
    if (!this.game) throw createOmniError('Backend', '请先初始化 Game，再切换渲染后端。');
    return this.game.backend.switch(backend);
  },
  async use(backend) {
    const entry = Deprecation.find('OmniCore.Backend.use');
    return Deprecation.forward({
      ...entry,
      target: () => Backend.switch(backend)
    });
  }
};

export async function loadPhysics(loader) {
  if (typeof loader !== 'function') throw createOmniError('Physics', '物理适配器加载器必须是函数。');
  return loader();
}

export class Game {
  constructor(config = {}) {
    this.config = normalizeConfig({
      ...config,
      renderer: config.renderer || config.backend
    });
    this.environment = detectEnvironment(globalThis);
    if (!Object.prototype.hasOwnProperty.call(config, 'platform') && this.environment.platform !== 'web') {
      this.config.platform = this.environment.platform;
    }
    this.hooks = {
      onStart: this.config.onStart,
      onPause: this.config.onPause,
      onResume: this.config.onResume,
      onVersionMismatch: this.config.onVersionMismatch,
      switchStart: this.config.switchStart,
      switchComplete: this.config.switchComplete
    };
    this.logger = new Logger({ debug: this.config.debug });
    Assert.configure({ enabled: this.config.debug === true });
    Pool.setDebug(Boolean(this.config.debug));
    this.platform = PlatformAdapter.prepare(this.config.platform, this.environment.raw);
    this.events = new EventBus();
    this.logger.setEventBus(this.events);
    this.timer = new Timer();
    this.timeGuard = new TimeGuard({
      enabled: this.config.timeGuard !== false,
      expectedFrameMs: this.config.timeGuard?.expectedFrameMs ?? 16,
      spikeMultiplier: this.config.timeGuard?.spikeMultiplier ?? 5,
      warn: (message, payload) => this.logger.warn('TimeGuard', message, payload)
    });
    this.core = new CoreContext(this.config);
    this.store = new Store(this.config.state || {});
    this.loader = new Loader({
      fetcher: this.environment.fetcher,
      onFriendlyError: (error) => this.events.emit('loader:error', error)
    });
    this.assetLoader = new AssetLoader({ fetcher: this.environment.fetcher, logger: this.logger });
    this.database = this.config.database instanceof Database ? this.config.database : DB;
    this.rendererManager = new RendererManager({
      createRenderer: (backend, options) => this.createRenderer(backend, options),
      fallbackOrder: ['webgpu', 'webgl', 'canvas'],
      logger: this.logger
    });
    this.loop = new Loop({
      fps: 60,
      framerateCap: this.config.framerateCap ?? 60,
      vsync: this.config.vsync ?? true,
      autoPause: true,
      onFrameStart: (frame) => this.snapshot?.startFrame?.(frame),
      onFrameEnd: (frame) => this.snapshot?.endFrame?.(frame),
      onFrameError: (error, frame) => this.snapshot?.rollbackOnError?.(error, frame),
      warnTimeJumps: this.config.warnTimeJumps ?? this.config.debug === true,
      onTimeJump: (payload) => this.logger.warn('Loop', '检测到大跨度时间跳跃，已限制增量时间', payload),
      timeGuard: this.timeGuard
    });
    this.snapshot = new Snapshot({
      game: this,
      logger: this.logger,
      enabled: this.config.snapshot !== false,
      leakRatio: this.config.snapshotLeakRatio,
      storeKeys: this.config.snapshotStoreKeys
    });
    this.input = null;
    this.camera = new Camera();
    this.scene = null;
    this.renderer = null;
    this.backend = new BackendManager(this);
    this.audio = new AudioManager();
    this.net = new NetManager({ fetcher: this.environment.fetcher });
    this.storage = StorageManager;
    this.auth = new AuthManager();
    this.worker = new WorkerManager(this.config.worker || {});
    this.aiImporter = new AIImporter({
      ...(this.config.ai || {}),
      fetcher: this.config.ai?.fetcher || this.environment.fetcher,
      injectScene: (sceneJson) => this.events.emit('ai:scene', sceneJson)
    });
    this.hotReload = this.config.hotReload ? new HotReload({
      ...(typeof this.config.hotReload === 'object' ? this.config.hotReload : {}),
      assetLoader: this.assetLoader,
      database: this.database,
      logger: this.logger
    }) : null;
    this.hotfixManager = this.config.hotfix ? new HotfixManager({
      ...(typeof this.config.hotfix === 'object' ? this.config.hotfix : {}),
      runtime: this
    }) : null;
    this.abtest = this.config.abtest ? ABTest.fromJSON(this.config.abtest) : null;
    this.dimension3D = null;
    this.dimension3DUnsubscribe = null;
    this.inspector = null;
    this.performanceMonitor = null;
    this.frameProfiler = null;
    this.profilerWaterfallPanel = null;
    this.profilerSnapshot = null;
    this.profilerSnapshotBinding = null;
    this.playSession = null;
    this.metrics = new PerformanceMetrics({ enabled: true });
    this.analytics = new Analytics({
      device: this.environment,
      fpsProvider: () => this.store.get('fps') || null,
      sceneProvider: () => this.scene?.current?.name || null,
      transport: this.config.analytics?.transport || null
    });
    this.remoteDevTools = null;
    this.emergencyOverlay = null;
    this.crashReporter = null;
    this.webglContext = null;
    this.transitionLayer = null;
    this.microkernelBridge = null;
    this.initialized = false;
    this.destroyed = false;
  }

  async init() {
    await safeInitialize('StorageManager', () => StorageManager.ensureEngineVersion({
      engineVersion: this.config.engineVersion,
      onVersionMismatch: this.hooks.onVersionMismatch,
      migrations: this.config.migrations
    }), null, this.logger);
    await safeInitialize('CoreContext', () => this.core.init(), (error) => {
      throw error;
    }, this.logger);
    this.transitionLayer = safeInitialize(
      'TransitionLayer',
      () => new TransitionLayer({ container: this.core.container }),
      null,
      this.logger
    );
    if (this.config.microkernel?.enabled) {
      const { default: OmniCoreBridge } = await import('../bridge/OmniCoreBridge.js');
      this.microkernelBridge = new OmniCoreBridge({
        game: this,
        config: this.config.microkernel,
        logger: this.logger
      });
      await this.microkernelBridge.init();
    }
    this._bindWebGLContextManager();
    if (this.config.databaseSources) await this.database.load(this.config.databaseSources);
    const requestedBackend = this.config.renderer === 'auto' ? 'auto' : this.config.renderer;
    const backendPreference = this._resolveRendererPreference(requestedBackend);
    const backend = backendPreference === 'auto' ? 'auto' : this.core.detectContext(backendPreference);
    this.renderer = await safeInitialize(
      'RendererManager',
      () => this.rendererManager.create(backend),
      (error) => this.createRenderer('canvas', { fallbackReason: error }),
      this.logger
    );
    this.core.autoResize(() => this.renderer);
    this.input = safeInitialize('InputManager', () => new InputManager({ target: this.core.canvas, events: this.events }), null, this.logger);
    this.scene = safeInitialize('SceneManager', () => new SceneManager(this), null, this.logger);
    if (this.config.debug || this.config.editorLiveEdit || this.config.profiler) {
      this.frameProfiler = safeInitialize(
        'FrameProfiler',
        () => new FrameProfiler({
          enabled: this.config.profiler !== false,
          limit: this.config.profilerLimit || 120
        }),
        null,
        this.logger
      );
    }
    if (this.config.editorLiveEdit || this.config.liveEdit || this.config.playSession) {
      const playSessionOptions = typeof this.config.playSession === 'object' ? this.config.playSession : {};
      this.playSession = safeInitialize(
        'PlaySession',
        () => new PlaySession({ game: this, ...playSessionOptions }),
        null,
        this.logger
      );
    }
    safeInitialize('TimerSubscription', () => this.loop.subscribe((delta) => this.timer.update(delta)), null, this.logger);

    if (this.config.dimension3D && !this.environment.skipThree) {
      this.dimension3D = new Dimension3D(this.config.dimension3D);
      await safeInitialize('Dimension3D', () => this.dimension3D.init(), () => {
        this.dimension3D?.destroy?.();
        this.dimension3D = null;
        return null;
      }, this.logger);
      if (this.dimension3D) {
        this.dimension3D.startRenderLoop?.({ fps: 30 });
        this.dimension3DUnsubscribe = () => this.dimension3D?.stopRenderLoop?.();
      }
    } else if (this.config.dimension3D && this.environment.skipThree) {
      this.logger.warn('platform', '检测到小游戏运行环境，已跳过 Three.js Dimension3D 初始化。');
    }

    if (this.config.debug) {
      this.emergencyOverlay = safeInitialize(
        'EmergencyOverlay',
        () => new EmergencyOverlay({ events: this.events, container: this.core.container }).attach(),
        null,
        this.logger
      );
      this.performanceMonitor = safeInitialize(
        'PerformanceMonitor',
        () => new PerformanceMonitor({ debug: true, container: this.core.container }),
        null,
        this.logger
      );
      this.performanceMonitor?.attach?.();
      if (this.frameProfiler && this.config.profilerPanel !== false) {
        this.profilerWaterfallPanel = safeInitialize(
          'ProfilerWaterfallPanel',
          () => new ProfilerWaterfallPanel({ debug: true, container: this.core.container }).attach(),
          null,
          this.logger
        );
      }
      this.profilerSnapshot = { latest: null };
      this.profilerSnapshotBinding = safeInitialize(
        'ProfilerSnapshot',
        () => ProfilerSnapshot.installDebugShortcut(this),
        null,
        this.logger
      );
      this.inspector = safeInitialize('Inspector', () => new Inspector(this), null, this.logger);
      this.inspector?.attach?.();
      this.remoteDevTools = safeInitialize(
        'RemoteDevTools',
        () => new RemoteDevTools(this, {
          debug: true,
          ...(typeof this.config.remoteDevTools === 'object' ? this.config.remoteDevTools : {})
        }),
        null,
        this.logger
      );
      this.remoteDevTools?.attach?.();
    }

    const crashReporterConfig = typeof this.config.crashReporter === 'object' ? this.config.crashReporter : {};
    const crashReporterTelemetry = CrashReporter.resolveTelemetryConfig(crashReporterConfig);
    if (this.config.crashReporter || crashReporterTelemetry.enabled) {
      this.crashReporter = new CrashReporter({
        ...crashReporterConfig,
        store: this.store,
        scene: this.scene,
        metrics: this.metrics
      }).install();
    }

    this.hotReload?.connect?.();
    if (this.config.hotfix?.poll !== false) this.hotfixManager?.start?.();

    Backend.bind(this);
    this.initialized = true;
    this.destroyed = false;
    if (this.config.autoStart) this.start();
    return this;
  }

  _resolveRendererPreference(requestedBackend) {
    const webKitLightMode = this.config.webkitLightMode !== false && isWebKitRuntime(this.environment);
    if (webKitLightMode && (requestedBackend === 'pixi' || requestedBackend === 'webgl')) {
      this.store?.set?.('renderer:requestedBackend', requestedBackend);
      this.store?.set?.('renderer:qualityProfile', {
        tier: 'low',
        reason: 'webkit-light-mode',
        requestedBackend
      });
      return 'canvas';
    }
    return requestedBackend;
  }

  start() {
    this.loop.start();
    this.hooks.onStart?.(this);
    this.events.emit('start', this);
  }

  pause() {
    this.loop.pause();
    this.hooks.onPause?.(this);
    this.events.emit('pause', this);
  }

  resume() {
    this.loop.resume();
    this.hooks.onResume?.(this);
    this.events.emit('resume', this);
  }

  async createRenderer(backend, options = {}) {
    if (backend === 'offscreen') {
      const renderer = new OffscreenCanvasRenderer({
        canvas: this.core.canvas,
        width: this.config.width,
        height: this.config.height,
        background: this.config.background,
        store: this.store,
        metrics: this.metrics,
        ...(this.config.offscreen || {})
      });
      await renderer.init();
      return renderer;
    }

    if (backend === 'webgpu') {
      const renderer = new WebGPURenderer({
        canvas: this.core.canvas,
        width: this.config.width,
        height: this.config.height,
        background: this.config.background,
        store: this.store,
        workerFactory: this.config.renderWorkerFactory || this.config.gpuWorkerFactory || null,
        metrics: this.metrics
      });
      await renderer.init();
      return renderer;
    }

    const renderer = new PixiRenderer({
      backend,
      canvas: this.core.canvas,
      width: this.config.width,
      height: this.config.height,
      background: this.config.background,
      autoResize: this.config.autoResize,
      store: this.store,
      fallbackReason: options.fallbackReason || null,
      metrics: this.metrics,
      commandBuffer: this.config.commandBuffer ?? this.config.pixi?.commandBuffer ?? false,
      commandCapacity: this.config.commandCapacity ?? this.config.pixi?.commandCapacity ?? 4096,
      spritePoolSize: this.config.spritePoolSize ?? this.config.pool?.spritePoolSize ?? 2048
    });
    await renderer.init();
    return renderer;
  }

  destroy() {
    this.loop?.stop?.();
    this.scene?.destroyAll?.();
    this.input?.destroy?.();
    this.renderer?.destroy?.();
    this.microkernelBridge?.destroy?.();
    this.webglContext?.destroy?.();
    this.hotReload?.disconnect?.();
    this.hotfixManager?.stop?.();
    this.worker?.destroy?.();
    this.dimension3DUnsubscribe?.();
    this.dimension3D?.destroy?.();
    this.audio?.stopAll?.();
    this.performanceMonitor?.destroy?.();
    this.profilerWaterfallPanel?.detach?.();
    this.profilerSnapshotBinding?.destroy?.();
    this.frameProfiler?.clear?.();
    this.remoteDevTools?.detach?.();
    this.emergencyOverlay?.detach?.();
    this.crashReporter?.destroy?.();
    this.inspector?.detach?.();
    this.transitionLayer?.destroy?.();
    this.snapshot?.destroy?.();
    this.core?.destroy?.();
    this.events?.clear?.();
    this.initialized = false;
    if (Backend.game === this) Backend.game = null;
    this.renderer = null;
    this.scene = null;
    this.input = null;
    this.webglContext = null;
    this.microkernelBridge = null;
    this.hotReload = null;
    this.hotfixManager = null;
    this.dimension3DUnsubscribe = null;
    this.dimension3D = null;
    this.performanceMonitor = null;
    this.profilerWaterfallPanel = null;
    this.profilerSnapshot = null;
    this.profilerSnapshotBinding = null;
    this.frameProfiler = null;
    this.playSession = null;
    this.remoteDevTools = null;
    this.emergencyOverlay = null;
    this.crashReporter = null;
    this.snapshot = null;
    this.inspector = null;
    this.transitionLayer = null;
    this.destroyed = true;
  }

  _bindWebGLContextManager() {
    const fallback = async () => {
      if (this.destroyed || this.backend.switching || this.renderer?.backend === 'canvas') return;
      await this.backend.switch('canvas');
    };

    if (!this.webglContext) {
      this.webglContext = new WebGLContextManager({
        canvas: this.core.canvas,
        restoreTimeout: this.config.webglRestoreTimeout ?? 2500,
        logger: this.logger,
        onLost: (payload) => this.events.emit('webgl:lost', payload),
        onRestored: (payload) => {
          this.events.emit('webgl:restored', payload);
          this.renderer?.renderScene?.(this.scene?.current);
        },
        onFallback: fallback
      });
      return;
    }

    this.webglContext.bind(this.core.canvas);
  }
}

export { CoreContext, StorageManager };
