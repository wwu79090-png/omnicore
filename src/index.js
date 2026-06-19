import { Backend, BackendManager, Game as CoreGame, StorageManager, loadPhysics } from './core/OmniCore.js';
import Deprecation from './core/Deprecation.js';
import { createOmniError } from './core/OmniError.js';
import EventBus from './core/EventBus.js';
import Sandbox, { Bus, SandboxBus } from './core/Sandbox.js';
import Task, { TaskManager } from './core/TaskManager.js';
import TaskScheduler from './core/TaskScheduler.js';
import Snapshot from './core/Snapshot.js';
import EntitySpatialIndex, { Query } from './core/EntitySpatialIndex.js';
import DualSpatialIndex from './core/DualSpatialIndex.js';
import Entity from './core/Entity.js';
import { FixedMemoryPool, Pool, PoolRegistry } from './core/MemoryPool.js';
import Animation from './animation/Animation.js';
import Camera from './camera/Camera.js';
import Node from './node/Node.js';
import { Scene, Sprite } from './scene/Scene.js';
import SceneManager from './scene/SceneManager.js';
import InputManager from './input/InputManager.js';
import Tween from './tween/Tween.js';
import Timer from './timer/Timer.js';
import Vec2 from './math/Vec2.js';
import Rect from './math/Rect.js';
import Easing from './math/Easing.js';
import Store from './store/Store.js';
import Loader from './loader/Loader.js';
import AssetLoader from './loader/AssetLoader.js';
import PixiRenderer from './renderer/PixiRenderer.js';
import WebGPURenderer from './renderer/WebGPURenderer.js';
import * as RendererBackend from './renderer/RendererBackend.js';
import { assertRendererBackend } from './renderer/RendererBackend.js';
import OffscreenCanvasRenderer from './renderer/OffscreenCanvasRenderer.js';
import RenderWorkerBridge from './renderer/RenderWorkerBridge.js';
import RendererManager from './renderer/RendererManager.js';
import WebGLContextManager from './renderer/WebGLContextManager.js';
import * as Filters from './renderer/Filters.js';
import StaticBatchCompiler from './renderer/StaticBatchCompiler.js';
import Loop from './loop/Loop.js';
import Button from './ui/Button.js';
import UIElement from './ui/UIElement.js';
import UIButton from './ui/UIButton.js';
import UITextInput from './ui/UITextInput.js';
import UIScrollView from './ui/UIScrollView.js';
import PrefabManager from './prefab/PrefabManager.js';
import Prefab, { PrefabRegistry } from './core/PrefabRegistry.js';
import ObjectPool from './pool/ObjectPool.js';
import ECS, {
  Components,
  MovementSystem,
  RenderSystem,
  World,
  benchmarkECSParticles
} from './core/ECS/index.js';
import Tilemap from './tilemap/Tilemap.js';
import AITilemapGenerator from './tilemap/AITilemapGenerator.js';
import TilemapLoader from './tilemap/TilemapLoader.js';
import ChunkCache from './tilemap/ChunkCache.js';
import ChunkManager from './tilemap/ChunkManager.js';
import EventSheet from './data/EventSheet.js';
import DataTable from './data/DataTable.js';
import DataTableEditor from './data/DataTableEditor.js';
import I18n from './data/I18n.js';
import Localization from './data/Localization.js';
import { DB, Database } from './database/Database.js';
import AudioManager from './audio/AudioManager.js';
import AudioEditor from './audio/AudioEditor.js';
import NetManager from './net/NetManager.js';
import NetRoom from './net/Room.js';
import RealtimeConnection from './net/RealtimeConnection.js';
import WebTransportConnection from './net/WebTransportConnection.js';
import NavigationAgent2D from './navigation/NavigationAgent2D.js';
import Inspector from './debug/Inspector.js';
import ApiQuickPanel from './debug/ApiQuickPanel.js';
import LiveInspector from './debug/LiveInspector.js';
import EditorOverlay from './debug/EditorOverlay.js';
import LogForwarder from './debug/LogForwarder.js';
import FrameProfiler from './debug/FrameProfiler.js';
import PerformanceMonitor from './debug/PerformanceMonitor.js';
import PerformanceMetrics from './debug/PerformanceMetrics.js';
import ProfilerWaterfallPanel from './debug/ProfilerWaterfallPanel.js';
import RemoteDevTools from './debug/RemoteDevTools.js';
import CrashReporter from './debug/CrashReporter.js';
import EmergencyOverlay from './debug/EmergencyOverlay.js';
import VersionDialog from './debug/VersionDialog.js';
import DebugConsole from './debug/DebugConsole.js';
import DevProfile from './debug/DevProfile.js';
import DeveloperUsageReport from './debug/DeveloperUsageReport.js';
import ErrorDiagnostics from './debug/ErrorDiagnostics.js';
import TelemetryCollector from './debug/TelemetryCollector.js';
import TelemetryDashboard from './debug/TelemetryDashboard.js';
import TutorialGuide from './debug/TutorialGuide.js';
import { Assert } from './debug/Assert.js';
import { help as describeHelp, listHelp } from './help/HelpRegistry.js';
import FeedbackWidget from './feedback/FeedbackWidget.js';
import AssetBrowser from './editor/AssetBrowser.js';
import EditorPlugin from './editor/EditorPlugin.js';
import EditorPanel from './editor/EditorPanel.js';
import EditorPluginCascade from './editor/EditorPluginCascade.js';
import PluginRecommendationEngine from './editor/PluginRecommendationEngine.js';
import PlaySession from './editor/PlaySession.js';
import RuntimeLiveSyncBridge from './editor/RuntimeLiveSyncBridge.js';
import AuthManager from './compliance/AuthManager.js';
import License from './compliance/License.js';
import PlatformAdapter from './platform/PlatformAdapter.js';
import ElectronNativeBridge from './platform/ElectronNativeBridge.js';
import Dimension3D from './dimension3d/Dimension3D.js';
import { detectEnvironment, safeInitialize } from './core/Bootstrap.js';
import TimeGuard from './core/TimeGuard.js';
import Templates from './core/Templates.js';
import Timeline from './timeline/Timeline.js';
import VisualEventGraph from './visualgraph/VisualEventGraph.js';
import HotReload from './hotreload/HotReload.js';
import HotfixManager from './hotfix/HotfixManager.js';
import AICommandService from './ai/AICommandService.js';
import AIImporter from './importer/AIImporter.js';
import WorkerManager from './worker/WorkerManager.js';
import SkeletalAnimation, { DragonBonesAdapter, SpineAdapter, SpinePixiRuntimeAdapter } from './animation/SkeletalAnimation.js';
import AnimationStateMachine from './animations/AnimationStateMachine.js';
import Light2D from './lighting/Light2D.js';
import ParticleEditorPanel from './editor/ParticleEditorPanel.js';
import AnimationEditor from './editor/AnimationEditor.js';
import SkeletonAnimationEditor from './editor/SkeletonAnimationEditor.js';
import InputSequence from './input/InputSequence.js';
import Analytics from './analytics/Analytics.js';
import ABTest from './experiments/ABTest.js';
import PackageManager from './package/PackageManager.js';
import MarketplaceServer from './marketplace/MarketplaceServer.js';
import OBundle from './assets/OBundle.js';
import AssetPatchManager from './assets/AssetPatchManager.js';
import PlatformVariantResolver from './assets/PlatformVariantResolver.js';
import BehaviorTree from './behavior/BehaviorTree.js';
import StateBehaviorTree from './behaviortree/BehaviorTree.js';
import ExportPaywall from './commercial/ExportPaywall.js';
import SleepWakeSystem from './optimization/SleepWakeSystem.js';
import ViewportCulling from './optimization/ViewportCulling.js';
import AdaptiveQualityManager from './optimization/AdaptiveQualityManager.js';
import DeviceProfiler from './optimization/DeviceProfiler.js';
import CollisionMask from './physics/CollisionMask.js';
import PhysicsQuery from './physics/PhysicsQuery.js';
import PhysicsWorld from './physics/PhysicsWorld.js';
import ComputeRuntime from './compute/ComputeRuntime.js';
import calculateDamage from './compute/DamageFormula.js';
import findPath from './compute/Pathfinding.js';
import WasmLoader from './wasm/WasmLoader.js';
import RenderLayerManager from './renderer/RenderLayerManager.js';
import PixiBatchAdapter, { CommandBuffer } from './renderer/PixiBatchAdapter.js';
import Kernel from './microkernel/Kernel.js';
import RendererAdapter from './microkernel/RendererAdapter.js';
import SplashScreen from './microkernel/SplashScreen.js';
import AudioAddon from './addons/Audio.js';
import CanvasRendererAddon from './addons/CanvasRenderer.js';
import PixiRendererAddon from './addons/PixiRenderer.js';
import Payment from './addons/Payment.js';
import Ad from './addons/Ad.js';
import WechatMiniGameMonetization from './addons/WechatMiniGameMonetization.js';
import LeanOmniCore, {
  Addons as LeanAddons,
  Core as LeanCore,
  createLeanRuntime
} from './lean/index.js';
import DebugRenderer, { createDebugAPI, isDebugBuildEnabled } from './debug/DebugRenderer.js';
import EngineQualityHarness, {
  runBudgetCheck,
  runDeterminismCheck,
  runEngineQualityGate,
  runInvariantCheck,
  stableHash,
  stableStringify
} from './quality/EngineQualityHarness.js';

let activeDebugAPI = createDebugAPI({ debug: false });
const Debug = {
  get enabled() {
    return activeDebugAPI.enabled;
  },
  get renderer() {
    return activeDebugAPI.renderer;
  },
  configure(options = {}) {
    activeDebugAPI = createDebugAPI(options);
    return this;
  },
  drawLine(...args) {
    return activeDebugAPI.drawLine(...args);
  },
  drawCircle(...args) {
    return activeDebugAPI.drawCircle(...args);
  },
  drawAABB(...args) {
    return activeDebugAPI.drawAABB(...args);
  },
  drawPhysicsWorld(...args) {
    return activeDebugAPI.drawPhysicsWorld(...args);
  },
  flush(...args) {
    return activeDebugAPI.flush(...args);
  },
  clear() {
    return activeDebugAPI.clear();
  }
};

/**
 * OmniCore public module entry.
 *
 * @example
 * import OmniCore from 'omnicore';
 * const game = await new OmniCore.Game({ renderer: 'pixi' }).init();
 * const scene = new OmniCore.Scene('menu');
 * scene.add(new OmniCore.Sprite('hero.png'));
 */
function resolveRuntimeConfig(config = {}) {
  if (Object.prototype.hasOwnProperty.call(config, 'platform') && config.platform !== 'auto') return config;
  const environment = detectEnvironment(globalThis);
  return {
    ...config,
    platform: environment.platform
  };
}

/**
 * Public Game wrapper.
 *
 * Keeps CoreGame behavior intact while adding optional headless runtime,
 * automatic platform override, and debug helper attachment from src/index.js.
 *
 * @example
 * const game = await new Game({ headless: true, autoStart: false }).init();
 *
 * @deprecated since 0.3.0, removeIn 2.0.0. Use `createGame(config)` for new projects.
 * @api OmniCore.Game
 * @pattern new OmniCore.Game(
 * @replacement createGame
 * @removeIn 2.0.0
 */
class Game extends CoreGame {
  constructor(config = {}) {
    super(resolveRuntimeConfig(config));
    this.headless = Boolean(this.config.headless);
    this.liveInspector = null;
    this.apiQuickPanel = null;
    this.feedbackWidget = null;
    this.editor = null;
    this.editorPanel = null;
    this.logForwarder = null;
    this.tutorialGuide = null;
    this.developerReport = null;
    this.telemetryCollector = null;
    this.telemetryDashboard = null;
    this.telemetryUnpatches = [];
    this.deviceProfiler = null;
    this.deviceProfile = null;
    this.adaptiveQualityManager = null;
    this.adaptiveQualityResult = null;
    this.versionDialog = null;
    this.debugRenderer = null;
    this.emergencyOverlay = null;
    this.culling = new ViewportCulling({
      ...(this.config.culling || {}),
      enabled: this.config.culling?.enabled ?? Boolean(this.config.culling)
    });
    this.sleepWake = new SleepWakeSystem({
      ...(this.config.sleepWake || this.config.sleeping || {}),
      enabled: this.config.sleepWake?.enabled ?? this.config.sleeping?.enabled ?? Boolean(this.config.sleepWake || this.config.sleeping)
    });
    this.worker?.registerBuiltins?.();
    this.store.debug = Boolean(this.config.debug);
    this.store.emergencyPatch = this.config.emergencyPatch || this.store.emergencyPatch;
    this.assetLoader.debug = Boolean(this.config.debug);
    this.aiCommand = new AICommandService({
      ...(typeof this.config.aiCommand === 'object' ? this.config.aiCommand : {}),
      fetcher: this.config.aiCommand?.fetcher || this.environment.fetcher
    });
  }

  async init() {
    if (!this.headless) {
      await super.init();
      this._attachRuntimeExtensions();
      await this._runAdaptiveQuality();
      return this;
    }

    await safeInitialize('StorageManager', () => StorageManager.ensureEngineVersion({
      engineVersion: this.config.engineVersion,
      onVersionMismatch: this.hooks.onVersionMismatch,
      migrations: this.config.migrations
    }), null, this.logger);

    if (this.config.databaseSources) await this.database.load(this.config.databaseSources);
    this.scene = safeInitialize('SceneManager', () => new SceneManager(this), null, this.logger);
    safeInitialize('TimerSubscription', () => this.loop.subscribe((delta) => this.timer.update(delta)), null, this.logger);
    Backend.bind(this);
    this.initialized = true;
    this.destroyed = false;
    if (this.config.autoStart) this.start();
    this._attachRuntimeExtensions();
    await this._runAdaptiveQuality();
    return this;
  }

  destroy() {
    this._detachRuntimeExtensions();
    super.destroy();
  }

  _attachRuntimeExtensions() {
    if (this.config.debug) {
      Debug.configure({ debug: true, mode: this.config.mode || 'development' });
      this.debugRenderer = Debug.renderer;
      if (this.renderer) this.renderer.debugRenderer = this.debugRenderer;
      this._attachTelemetryInstrumentation();
      this.liveInspector = this.liveInspector || new LiveInspector(this, this.config.liveInspector || {});
      this.liveInspector.attach();
      if (this.config.editorOverlay !== false) {
        const options = typeof this.config.editorOverlay === 'object' ? this.config.editorOverlay : {};
        this.editorOverlay = this.editorOverlay || new EditorOverlay(this, options);
        this.editorOverlay.attach();
      }
      this.apiQuickPanel = this.apiQuickPanel || new ApiQuickPanel({ game: this });
      this.apiQuickPanel.attach();
      if (this.config.logForwarder !== false) {
        const options = typeof this.config.logForwarder === 'object' ? this.config.logForwarder : {};
        this.logForwarder = this.logForwarder || new LogForwarder(options);
        this.logForwarder.attach();
      }
      this.developerReport = this.developerReport || new DeveloperUsageReport({ debug: true });
      this.developerReport.record('Game.debugAttach');
      this.telemetryDashboard = this.telemetryDashboard || new TelemetryDashboard({
        debug: true,
        collector: this.telemetryCollector
      });
      this.telemetryDashboard.attach();
      this.emergencyOverlay = this.emergencyOverlay || new EmergencyOverlay({
        events: this.events,
        container: this.core?.container
      });
      this.emergencyOverlay.attach();
      if (this.config.tutorialGuide !== false) {
        const options = typeof this.config.tutorialGuide === 'object' ? this.config.tutorialGuide : {};
        this.tutorialGuide = this.tutorialGuide || new TutorialGuide({ debug: true, ...options });
        this.tutorialGuide.attach();
      }
      if (this.config.editorPanel !== false) {
        const options = typeof this.config.editorPanel === 'object' ? this.config.editorPanel : {};
        this.editorPanel = this.editorPanel || new EditorPanel(this, options);
        this.editorPanel.attach();
      }
    }

    if (this.config.feedback) {
      const options = typeof this.config.feedback === 'object' ? this.config.feedback : {};
      this.feedbackWidget = this.feedbackWidget || new FeedbackWidget(this, options);
      this.feedbackWidget.attach();
    }

    if (this.config.editor) {
      const options = typeof this.config.editor === 'object'
        ? this.config.editor
        : typeof this.config.editorPanel === 'object'
          ? this.config.editorPanel
          : {};
      this.editor = this.editor || this.editorPanel || new EditorPanel(this, options);
      this.editor.attach();
    }

    const version = this.config.version || this.config.engineVersion || '0.1.0';
    if (this.config.showChangelog !== false && (this.config.changelog || this.config.version || this.config.engineVersion)) {
      this.versionDialog = this.versionDialog || new VersionDialog(this, {
        version,
        changelog: this.config.changelog || ''
      });
      this.versionDialog.showIfNeeded();
    }
  }

  _attachTelemetryInstrumentation() {
    if (!this.config.debug) return;
    this.telemetryCollector = this.telemetryCollector || new TelemetryCollector({ debug: true });
    if (this.telemetryUnpatches.length) return;
    const wrap = (target, method, api, options) => {
      const unpatch = this.telemetryCollector.wrapMethod(target, method, api, options);
      this.telemetryUnpatches.push(unpatch);
    };
    wrap(this.store, 'set', 'Store.set', { configPath: (key) => `state.${key}` });
    wrap(this.store, 'get', 'Store.get', { configPath: (key) => `state.${key}` });
    wrap(this.events, 'emit', 'EventBus.emit', { configPath: (event) => `event.${event}` });
    wrap(this.events, 'on', 'EventBus.on', { configPath: (event) => `event.${event}` });
    wrap(this.net, 'request', 'Net.request', { configPath: (url) => `net.${url}` });
    wrap(this.worker, 'run', 'Worker.run', { configPath: (task) => `worker.${task}` });
    if (this.renderer) wrap(this.renderer, 'renderScene', 'Renderer.renderScene', { configPath: () => 'renderer.scene' });
  }

  async _runAdaptiveQuality() {
    const hardMaintainConfig = this.config.targetFpsHardMaintain || this.config.targetFrameRateHardMaintain;
    if (!this.config.adaptiveQuality && !hardMaintainConfig) return null;
    const options = typeof this.config.adaptiveQuality === 'object' ? this.config.adaptiveQuality : {};
    const hardOptions = typeof hardMaintainConfig === 'object' ? hardMaintainConfig : {};
    const hardMaintain = options.hardMaintain
      ?? options.targetFpsHardMaintain
      ?? options.targetFrameRateHardMaintain
      ?? Boolean(hardMaintainConfig);
    this.deviceProfiler = this.deviceProfiler || new DeviceProfiler(options.profile || options);
    this.adaptiveQualityManager = this.adaptiveQualityManager || new AdaptiveQualityManager({
      renderer: this.renderer,
      culling: this.culling,
      loop: this.loop,
      store: this.store,
      particleScale: options.particleScale ?? 0.5,
      maxVisibleTileChunks: options.maxVisibleTileChunks ?? hardOptions.maxVisibleTileChunks ?? 6,
      hardMaintain,
      targetFps: options.targetFps ?? hardOptions.targetFps ?? 30,
      lowFpsFrames: options.lowFpsFrames ?? hardOptions.lowFpsFrames ?? 120,
      lowPowerFps: options.lowPowerFps ?? 30,
      lowPowerTextureQuality: options.lowPowerTextureQuality ?? 0.5,
      lowBatteryThreshold: options.lowBatteryThreshold ?? 0.2
    });
    if (!this.config.adaptiveQuality) {
      this.adaptiveQualityResult = {
        profile: null,
        applied: [],
        hardMaintain
      };
      this.store?.set?.('renderer:adaptiveQuality', this.adaptiveQualityResult);
      return this.adaptiveQualityResult;
    }
    this.deviceProfile = await this.deviceProfiler.profile();
    this.adaptiveQualityResult = this.adaptiveQualityManager.apply(this.deviceProfile);
    if (options.powerState || options.lowPowerMode || options.batteryLevel != null || options.thermalState) {
      this.adaptivePowerResult = this.adaptiveQualityManager.applyPowerState(options.powerState || {
        lowPowerMode: options.lowPowerMode,
        batteryLevel: options.batteryLevel,
        thermalState: options.thermalState,
        saveData: options.saveData
      });
    }
    this.store?.set?.('device:profile', this.deviceProfile);
    this.store?.set?.('renderer:adaptiveQuality', this.adaptiveQualityResult);
    return this.adaptiveQualityResult;
  }

  _detachRuntimeExtensions() {
    for (const unpatch of this.telemetryUnpatches.splice(0)) unpatch?.();
    this.liveInspector?.detach?.();
    this.editorOverlay?.detach?.();
    this.apiQuickPanel?.detach?.();
    this.feedbackWidget?.detach?.();
    this.telemetryDashboard?.detach?.();
    this.emergencyOverlay?.detach?.();
    this.developerReport?.generate?.({ reason: 'game-detach' });
    this.tutorialGuide?.detach?.();
    if (this.editor && this.editor !== this.editorPanel) this.editor.detach?.();
    this.editorPanel?.detach?.();
    this.logForwarder?.detach?.();
    this.versionDialog?.detach?.();
    this.debugRenderer?.clear?.();
    if (this.renderer?.debugRenderer === this.debugRenderer) this.renderer.debugRenderer = null;
    this.liveInspector = null;
    this.editorOverlay = null;
    this.apiQuickPanel = null;
    this.feedbackWidget = null;
    this.tutorialGuide = null;
    this.developerReport = null;
    this.telemetryCollector = null;
    this.telemetryDashboard = null;
    this.emergencyOverlay = null;
    this.deviceProfiler = null;
    this.deviceProfile = null;
    this.adaptiveQualityManager = null;
    this.adaptiveQualityResult = null;
    this.editor = null;
    this.editorPanel = null;
    this.logForwarder = null;
    this.versionDialog = null;
    this.debugRenderer = null;
  }
}

/**
 * Creates a Game instance without using the deprecated constructor surface.
 *
 * @param {object} config Game configuration.
 * @returns {Game} Uninitialized Game instance; call `.init()` when needed.
 */
function createGame(config = {}) {
  return new Game(config);
}

/**
 * Creates an entity through the new top-level factory.
 *
 * @param {string|Function|object} type Entity type, constructor, or object.
 * @param {object} props Entity properties.
 * @returns {object} Entity instance.
 */
function createEntity(type = 'Node', props = {}) {
  return Entity.createEntity(type, props);
}

const System = {
  Auth: new AuthManager()
};

InputManager.Sequence = InputSequence;
NetManager.Room = NetRoom;

const addonRegistry = new Map();

const GENEALOGY = Object.freeze({
  engine: 'OmniCore',
  author: 'OmniCore Open Engine Maintainers',
  philosophy: ['logic-driven-rendering', 'microkernel', 'native-interaction', 'graceful-degradation'],
  timestamp: new Date().toISOString(),
  sealedTimestamp: null,
  proof: 'OmniCore.Genealogy() build watermark'
});

function Genealogy() {
  const input = `${GENEALOGY.engine}:${GENEALOGY.author}:${GENEALOGY.timestamp}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash + input.charCodeAt(index) * (index + 1)) % 4294967291;
    hash = (hash * 16777619) % 4294967291;
  }
  return { ...GENEALOGY, sealedTimestamp: `${GENEALOGY.timestamp}.${hash.toString(36)}` };
}

function help(apiName) {
  const entry = describeHelp(apiName);
  if (typeof console !== 'undefined') console.info?.('[OmniCore.help]', entry);
  return entry;
}

function addon(name, plugin) {
  if (!name || !plugin) throw createOmniError('Addon', '注册插件需要同时传入名称和插件对象。');
  addonRegistry.set(name, plugin);
  return plugin;
}

async function useAddon(name, context = {}) {
  const plugin = addonRegistry.get(name);
  if (!plugin) throw createOmniError('Addon', `插件尚未注册：${name}`);
  if (typeof plugin.init === 'function') await plugin.init(OmniCore, context);
  else await plugin.install?.(OmniCore, context);
  return plugin;
}

async function use(pluginOrName, context = {}) {
  if (typeof pluginOrName === 'string') return useAddon(pluginOrName, context);
  const plugin = pluginOrName?.default || pluginOrName;
  if (!plugin?.name || typeof plugin.install !== 'function') {
    throw createOmniError('Addon', 'OmniCore.use() 需要插件名称或带有 name/install 的插件对象。');
  }
  addonRegistry.set(plugin.name, plugin);
  await plugin.install(OmniCore, context);
  return plugin;
}

async function disableAddon(name, context = {}) {
  const plugin = addonRegistry.get(name);
  await plugin?.destroy?.(context);
  return plugin || null;
}

function connectEditorSync(game, options = {}) {
  const bridge = new RuntimeLiveSyncBridge({ game, ...options });
  return options.transport ? bridge.connect(options.transport) : bridge;
}

const OmniCore = {
  Game,
  createGame,
  Genealogy,
  help,
  listHelp,
  addon,
  use,
  useAddon,
  disableAddon,
  connectEditorSync,
  EventBus,
  Sandbox,
  SandboxBus,
  Bus,
  Task,
  TaskManager,
  TaskScheduler,
  Query,
  EntitySpatialIndex,
  DualSpatialIndex,
  AssetBrowser,
  Editor: EditorPanel,
  EditorPlugin,
  EditorPluginCascade,
  EditorPanel,
  PlaySession,
  RuntimeLiveSyncBridge,
  PluginRecommendationEngine,
  Lean: LeanOmniCore,
  LeanCore,
  LeanAddons,
  createLeanRuntime,
  Node,
  Scene,
  Sprite,
  Entity,
  createEntity,
  Snapshot,
  Tween,
  Input: InputManager,
  InputManager,
  InputSequence,
  Camera,
  Timer,
  TimeGuard,
  Animation,
  UI: { Button, UIElement, UIButton, UITextInput, UIScrollView },
  Prefab,
  PrefabRegistry,
  PrefabManager,
  Templates,
  Backend,
  Dimension3D,
  Deprecation,
  Store,
  install: (name, options) => Store.install(name, options),
  Loader,
  AssetLoader,
  Renderer: { PixiRenderer, WebGPURenderer, RendererBackend, OffscreenCanvasRenderer, RenderWorkerBridge, Filters, WebGLContextManager, RendererManager, RenderLayerManager, PixiBatchAdapter, CommandBuffer, StaticBatchCompiler },
  RendererBackend,
  assertRendererBackend,
  PixiBatchAdapter,
  StaticBatchCompiler,
  CommandBuffer,
  WebGPURenderer,
  OffscreenCanvasRenderer,
  RenderWorkerBridge,
  RendererManager,
  RenderLayerManager,
  Loop,
  Math: { Vec2, Rect, Easing },
  ECS,
  Components,
  World,
  MovementSystem,
  RenderSystem,
  benchmarkECSParticles,
  Database,
  DB,
  Tilemap,
  AITilemapGenerator,
  TilemapLoader,
  ChunkCache,
  ChunkManager,
  Timeline,
  VisualEventGraph,
  HotReload,
  HotfixManager,
  AICommandService,
  AIImporter,
  Analytics,
  AssetPatchManager,
  ABTest,
  PackageManager,
  MarketplaceServer,
  OBundle,
  PlatformVariantResolver,
  Worker: WorkerManager,
  WorkerManager,
  ComputeRuntime,
  WasmLoader,
  findPath,
  calculateDamage,
  BehaviorTree,
  StateBehaviorTree,
  SkeletalAnimation,
  SpineAdapter,
  SpinePixiRuntimeAdapter,
  DragonBonesAdapter,
  AnimationStateMachine,
  Light2D,
  ParticleEditorPanel,
  AnimationEditor,
  SkeletonAnimationEditor,
  PhysicsWorld,
  PhysicsQuery,
  CollisionMask,
  ExportPaywall,
  SleepWakeSystem,
  ViewportCulling,
  AdaptiveQualityManager,
  DeviceProfiler,
  Quality: EngineQualityHarness,
  EngineQualityHarness,
  Kernel,
  RendererAdapter,
  SplashScreen,
  AudioAddon,
  CanvasRendererAddon,
  PixiRendererAddon,
  Payment,
  Ad,
  WechatMiniGameMonetization,
  AudioManager,
  AudioEditor,
  DataTable,
  DataTableEditor,
  I18n,
  Localization,
  EventSheet,
  ObjectPool,
  Pool,
  PoolRegistry,
  FixedMemoryPool,
  Storage: StorageManager,
  Net: NetManager,
  NetRoom,
  NavigationAgent2D,
  RealtimeConnection,
  WebTransportConnection,
  System,
  License,
  PlatformAdapter,
  ElectronNativeBridge,
  ApiQuickPanel,
  Debug,
  Assert,
  DebugRenderer,
  isDebugBuildEnabled,
  DebugConsole,
  DevProfile,
  DeveloperUsageReport,
  ErrorDiagnostics,
  EmergencyOverlay,
  Console: {
    DebugConsole,
    ErrorDiagnostics,
    analyzeError: (error) => ErrorDiagnostics.analyze(error)
  },
  TelemetryCollector,
  TelemetryDashboard,
  TutorialGuide,
  FeedbackWidget,
  LiveInspector,
  EditorOverlay,
  LogForwarder,
  FrameProfiler,
  PerformanceMonitor,
  PerformanceMetrics,
  ProfilerWaterfallPanel,
  RemoteDevTools,
  CrashReporter,
  VersionDialog,
  detectEnvironment,
  Bootstrap: { detectEnvironment, safeInitialize, Sandbox, Bus },
  safeInitialize,
  loadPhysics
};

Object.defineProperty(OmniCore, 'Assert', {
  configurable: true,
  enumerable: false,
  writable: false,
  value: Assert
});

export default OmniCore;
export {
  ABTest,
  AudioManager,
  AudioAddon,
  Ad,
  AudioEditor,
  AssetBrowser,
  AICommandService,
  AIImporter,
  AITilemapGenerator,
  Analytics,
  Animation,
  AnimationEditor,
  AnimationStateMachine,
  ApiQuickPanel,
  AssetPatchManager,
  AssetLoader,
  Backend,
  BackendManager,
  BehaviorTree,
  Button,
  Camera,
  CanvasRendererAddon,
  AdaptiveQualityManager,
  ChunkCache,
  ChunkManager,
  CollisionMask,
  ComputeRuntime,
  CommandBuffer,
  Components,
  CrashReporter,
  DataTable,
  DataTableEditor,
  Database,
  DB,
  Debug,
  DebugConsole,
  DebugRenderer,
  DevProfile,
  DeveloperUsageReport,
  DeviceProfiler,
  Deprecation,
  Dimension3D,
  DragonBonesAdapter,
  Assert,
  Easing,
  ECS,
  ElectronNativeBridge,
  EditorPanel,
  EditorOverlay,
  EditorPlugin,
  EditorPluginCascade,
  EmergencyOverlay,
  ErrorDiagnostics,
  EventSheet,
  EventBus,
  EntitySpatialIndex,
  DualSpatialIndex,
  EngineQualityHarness,
  ExportPaywall,
  FeedbackWidget,
  FixedMemoryPool,
  FrameProfiler,
  Genealogy,
  help,
  createGame,
  Game,
  HotReload,
  HotfixManager,
  I18n,
  Localization,
  InputManager,
  InputSequence,
  Inspector,
  isDebugBuildEnabled,
  Kernel,
  LeanAddons,
  LeanCore,
  LeanOmniCore,
  listHelp,
  License,
  LiveInspector,
  Loader,
  LogForwarder,
  Loop,
  Light2D,
  MarketplaceServer,
  MovementSystem,
  NetManager,
  NetRoom,
  NavigationAgent2D,
  RealtimeConnection,
  Node,
  ObjectPool,
  OBundle,
  Entity,
  createEntity,
  Snapshot,
  Pool,
  PoolRegistry,
  OffscreenCanvasRenderer,
  PerformanceMonitor,
  PerformanceMetrics,
  ParticleEditorPanel,
  PhysicsWorld,
  PhysicsQuery,
  PixiRenderer,
  PixiBatchAdapter,
  PixiRendererAddon,
  PluginRecommendationEngine,
  PlaySession,
  Payment,
  PackageManager,
  PlatformAdapter,
  PlatformVariantResolver,
  Prefab,
  PrefabManager,
  PrefabRegistry,
  ProfilerWaterfallPanel,
  Query,
  Rect,
  runBudgetCheck,
  runDeterminismCheck,
  runEngineQualityGate,
  runInvariantCheck,
  RenderLayerManager,
  RenderWorkerBridge,
  RemoteDevTools,
  RendererBackend,
  RendererAdapter,
  RendererManager,
  RenderSystem,
  RuntimeLiveSyncBridge,
  Sandbox,
  SandboxBus,
  Scene,
  SceneManager,
  SleepWakeSystem,
  Sprite,
  SplashScreen,
  stableHash,
  stableStringify,
  StaticBatchCompiler,
  SkeletalAnimation,
  SkeletonAnimationEditor,
  SpineAdapter,
  SpinePixiRuntimeAdapter,
  StateBehaviorTree,
  StorageManager,
  Store,
  System,
  Task,
  TaskManager,
  TaskScheduler,
  TimeGuard,
  TelemetryCollector,
  TelemetryDashboard,
  Timer,
  Tilemap,
  TilemapLoader,
  Timeline,
  Templates,
  TutorialGuide,
  Tween,
  UIElement,
  UIButton,
  UIScrollView,
  UITextInput,
  VersionDialog,
  VisualEventGraph,
  Vec2,
  ViewportCulling,
  WasmLoader,
  WebGLContextManager,
  WebGPURenderer,
  WebTransportConnection,
  WechatMiniGameMonetization,
  WorkerManager,
  World,
  assertRendererBackend,
  Bus,
  benchmarkECSParticles,
  createLeanRuntime,
  addon,
  calculateDamage,
  disableAddon,
  use,
  connectEditorSync,
  detectEnvironment,
  findPath,
  useAddon,
  safeInitialize,
  loadPhysics
};
