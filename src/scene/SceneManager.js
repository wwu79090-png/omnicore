import Scene from './Scene.js';
import createSceneServices from './SceneServices.js';
import { createOmniError } from '../core/OmniError.js';

/**
 * Phaser-inspired scene stack manager.
 *
 * Supports `push`, `pop`, `replace`, `fadeIn`, and `fadeOut` while destroying
 * popped scene resources automatically.
 *
 * @example
 * const scenes = new SceneManager(game);
 * scenes.register(new Scene('menu'));
 * await scenes.push('menu', { fadeIn: 250 });
 */
export class SceneManager {
  constructor(game) {
    this.game = game;
    this.registry = new Map();
    this.stack = [];
    this.overlays = new Map();
    this.ready = Promise.resolve(null);
    this.pendingSceneOptions = new Map();
    this.reactiveSceneName = null;
    this.unsubscribeLoop = game?.loop?.subscribe?.((delta, time) => this.update(delta, time));
    this.unsubscribeRender = game?.loop?.subscribeRender?.((alpha, time, frame) => this.render(alpha, time, frame));
    this.unsubscribeSceneStore = game?.store?.subscribe?.('currentScene', (name) => {
      this.ready = this.ready.then(() => this._transitionToStoreScene(name, this._takeSceneOptions(name)));
    });
  }

  get current() {
    return this.stack[this.stack.length - 1] || null;
  }

  register(nameOrScene, sceneOrFactory) {
    if (nameOrScene instanceof Scene || typeof nameOrScene === 'object') {
      this.registry.set(nameOrScene.name, nameOrScene);
      return nameOrScene;
    }
    this.registry.set(nameOrScene, sceneOrFactory);
    return sceneOrFactory;
  }

  async push(name, options = {}) {
    if (this.game?.store) {
      this.pendingSceneOptions.set(name, options);
      this.game.store.set('currentScene', name);
      await this.ready;
      return this.current;
    }
    const scene = await this._createScene(name, options.data);
    if (this.current) this.current.active = false;
    this.stack.push(scene);
    await this._bootScene(scene, options.data);
    scene.enter?.(options.data);
    if (options.fadeIn) await this.fadeIn(options.fadeIn);
    this.game?.renderer?.renderScene?.(scene);
    return scene;
  }

  async pop(options = {}) {
    if (this.game?.store) {
      const scene = this.current;
      if (!scene) return null;
      this.pendingSceneOptions.set(null, options);
      this.game.store.set('currentScene', null);
      await this.ready;
      return scene;
    }
    const scene = this.stack.pop();
    if (!scene) return null;
    if (options.fadeOut) await this.fadeOut(options.fadeOut);
    scene.exit?.(options.data);
    scene.destroy();
    this.game?.pool?.releaseAll?.();
    if (this.current) this.current.active = true;
    this.game?.renderer?.renderScene?.(this.current);
    return scene;
  }

  async replace(name, options = {}) {
    if (this.game?.store) return this.push(name, options);
    if (this.current) await this.pop({ fadeOut: options.fadeOut });
    return this.push(name, options);
  }

  async overlay(id, sceneOrName, options = {}) {
    if (!id) throw createOmniError('Scene', 'overlay(id, scene) 需要叠加层 id。');
    if (this.overlays.has(id)) this.dismiss(id);
    const scene = typeof sceneOrName === 'string'
      ? await this._createScene(sceneOrName, options.data)
      : await this._prepareProvidedScene(sceneOrName, options.data);
    scene.active = true;
    scene.overlay = true;
    scene.overlayId = id;
    this.overlays.set(id, scene);
    await this._bootScene(scene, options.data);
    scene.enter?.(options.data);
    this.game?.events?.emit?.('scene:overlay', { id, scene });
    this.game?.renderer?.renderScene?.(scene);
    return scene;
  }

  async pushOverlay(sceneOrName, options = {}) {
    const id = options.id
      || (typeof sceneOrName === 'string' ? sceneOrName : sceneOrName?.overlayId || sceneOrName?.name)
      || `overlay-${this.overlays.size + 1}`;
    const scene = await this.overlay(id, sceneOrName, {
      ...options,
      blockUnderlying: false
    });
    scene.uiOnly = options.uiOnly ?? true;
    scene.blocksUnderlying = false;
    return scene;
  }

  dismiss(id) {
    const scene = this.overlays.get(id);
    if (!scene) return null;
    this.overlays.delete(id);
    this.game?.events?.emit?.('scene:dismiss', { id, scene });
    scene.exit?.();
    scene.destroy?.();
    this.game?.pool?.releaseAll?.();
    return scene;
  }

  async load(name, options = {}) {
    const transitionLayer = this.game?.transitionLayer;
    transitionLayer?.show?.('正在编译世界...');
    const loaderOptions = options.loaderOptions || options.loadOptions || {};
    let bundle = null;

    try {
      if (options.bundle || options.assets) {
        bundle = await this.game?.loader?.loadBundle?.(options.bundle || options.assets, loaderOptions);
      }

      const data = {
        ...(options.data || {}),
        bundle,
        assets: bundle
      };
      const scene = options.replace === false
        ? await this.push(name, { ...options, data })
        : await this.replace(name, { ...options, data });
      transitionLayer?.hide?.({ fadeMs: options.fadeMs ?? 200 });
      return scene;
    } catch (error) {
      transitionLayer?.hide?.({ fadeMs: options.fadeMs ?? 200 });
      this.game?.events?.emit?.('error', error);
      throw error;
    }
  }

  async loadSceneWithTransition(name, options = {}) {
    const overlay = this._createLoadingOverlay(options);
    overlay?.setProgress?.(10);
    await Promise.resolve(options.beforeLoad?.());
    overlay?.setProgress?.(40);
    const scene = await this.replace(name, {
      ...options,
      fadeOut: options.fadeOut ?? 180,
      fadeIn: options.fadeIn ?? 180
    });
    overlay?.setProgress?.(100);
    await this._delay(options.completeDelay ?? 120);
    overlay?.hide?.();
    return scene;
  }

  async fadeIn(duration = 250) {
    return this.game?.renderer?.fade?.('in', duration) || Promise.resolve();
  }

  async fadeOut(duration = 250) {
    return this.game?.renderer?.fade?.('out', duration) || Promise.resolve();
  }

  update(delta, time) {
    const profiler = this.game?.frameProfiler || null;
    const frameIndex = this.game?.loop?.frame || this.game?.playSession?.frame || 0;
    profiler?.startFrame?.({ frame: frameIndex, time });
    const store = this.game?.store || null;
    store?.beginFrame?.();
    try {
      measureFrameSection(profiler, 'input.update', () => {
        if (this.game?.input?.refresh) return this.game.input.refresh(delta, time);
        return this.game?.input?.update?.(delta, time);
      });
      measureFrameSection(profiler, 'camera.update', () => this.game?.camera?.update?.(delta, time));
      const shouldAdvance = this.game?.playSession?.shouldAdvanceSimulation?.() ?? true;
      if (shouldAdvance) {
        measureFrameSection(profiler, 'scene.update', () => this.current?.update?.(delta, time));
        measureFrameSection(profiler, 'scene.overlay.update', () => {
          for (const overlay of this.overlays.values()) overlay.update?.(delta, time);
        });
      }
      store?.commit?.();
    } catch (error) {
      store?.rollback?.();
      throw error;
    }
    this.game?.adaptiveQualityManager?.observeFrame?.({
      fps: delta > 0 ? Math.round(1 / delta) : 0,
      scene: this.current,
      renderer: this.game?.renderer,
      culling: this.game?.culling,
      sleepWake: this.game?.sleepWake,
      store: this.game?.store,
      reason: 'frame'
    });
  }

  render(alpha = 0, time = 0, frameContext = {}) {
    const profiler = this.game?.frameProfiler || null;
    const renderStart = now();
    this.current?.render?.(alpha, time, frameContext);
    this.game?.renderer?.renderScene?.(this.current);
    for (const overlay of this.overlays.values()) {
      overlay.render?.(alpha, time, frameContext);
      this.game?.renderer?.renderScene?.(overlay);
    }
    const renderEnd = now();
    const renderMs = renderEnd - renderStart;
    profiler?.record?.('renderer.renderScene', renderMs);
    const delta = this.game?.time?.delta || frameContext?.delta || 0;
    const fps = delta > 0 ? Math.round(1 / delta) : this.game?.performanceMonitor?.current?.fps || 0;
    measureFrameSection(profiler, 'performance.monitor', () => this.game?.performanceMonitor?.updateFromGame?.(this.game, delta, renderMs));
    this.game?.adaptiveQualityManager?.observeFrame?.({
      fps,
      renderMs,
      scene: this.current,
      renderer: this.game?.renderer,
      culling: this.game?.culling,
      sleepWake: this.game?.sleepWake,
      store: this.game?.store,
      reason: 'frame'
    });
    const frame = profiler?.endFrame?.();
    if (frame) {
      this.game?.store?.set?.('profiler:frame', frame);
      this.game?.profilerWaterfallPanel?.refresh?.(frame);
      this.game?.editorSync?.publishProfilerFrame?.(frame);
      this.game?.liveSyncBridge?.publishProfilerFrame?.(frame);
    }
    this.game?.playSession?.advanceFrame?.();
  }

  destroyAll() {
    while (this.stack.length) {
      const scene = this.stack.pop();
      scene.exit?.();
      scene.destroy();
    }
    for (const id of [...this.overlays.keys()]) this.dismiss(id);
    this.unsubscribeLoop?.();
    this.unsubscribeRender?.();
    this.unsubscribeSceneStore?.();
    this.registry.clear();
  }

  _takeSceneOptions(name) {
    const options = this.pendingSceneOptions.get(name) || {};
    this.pendingSceneOptions.delete(name);
    return options;
  }

  async _transitionToStoreScene(name, options = {}) {
    if (name === this.reactiveSceneName) return this.current;
    const previous = this.current;
    if (previous) {
      if (options.fadeOut) await this.fadeOut(options.fadeOut);
      this.game?.events?.emit?.('scene:unmount', { name: previous.name, scene: previous });
      previous.exit?.(options.data);
      previous.destroy();
      this.game?.pool?.releaseAll?.();
    }
    this.stack.length = 0;
    this.reactiveSceneName = name || null;
    if (!name) {
      this.game?.renderer?.releaseSceneTextures?.(null);
      this.game?.renderer?.renderScene?.(null);
      return null;
    }

    const scene = await this._createScene(name, options.data);
    this.stack.push(scene);
    await this._bootScene(scene, options.data);
    scene.enter?.(options.data);
    if (options.fadeIn) await this.fadeIn(options.fadeIn);
    this.game?.events?.emit?.('scene:mount', { name, scene });
    this.game?.renderer?.releaseSceneTextures?.(scene);
    this.game?.renderer?.renderScene?.(scene);
    return scene;
  }

  async _createScene(name, data) {
    const entry = this.registry.get(name);
    if (!entry) throw createOmniError('Scene', `场景尚未注册：${name}`);
    const scene = typeof entry === 'function' ? await entry(data) : entry;
    scene.debug = Boolean(this.game?.config?.debug);
    scene.game = this.game;
    createSceneServices(scene, this.game || {});
    return scene;
  }

  async _prepareProvidedScene(scene, data) {
    if (!scene) throw createOmniError('Scene', 'overlay(id, scene) 需要有效场景。');
    scene.debug = Boolean(this.game?.config?.debug);
    scene.game = this.game;
    createSceneServices(scene, this.game || {});
    await Promise.resolve(data);
    return scene;
  }

  async _bootScene(scene, data) {
    if (scene.created) return;
    scene._transitionLifecycle?.('init', { data });
    await scene.init?.(data, scene.lifecycleSignal);
    scene.lifecycle?.assertAlive?.();
    scene._transitionLifecycle?.('preload', { data });
    await scene.preload?.(data, scene.lifecycleSignal);
    scene.lifecycle?.assertAlive?.();
    scene._transitionLifecycle?.('create', { data });
    await scene.create?.(data, scene.lifecycleSignal);
    scene.lifecycle?.assertAlive?.();
    scene.created = true;
  }

  _createLoadingOverlay(options = {}) {
    if (typeof document === 'undefined') return null;
    const root = document.createElement('div');
    root.dataset.omnicoreLoading = 'true';
    root.innerHTML = `
      <div class="omnicore-loading-band"></div>
      <div class="omnicore-loading-text">Loading 0%</div>
    `;
    Object.assign(root.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.92)',
      display: 'grid',
      placeItems: 'center',
      color: '#e2e8f0',
      zIndex: String(options.zIndex || 2147483645),
      opacity: '1',
      transition: 'opacity 180ms ease'
    });
    const band = root.querySelector('.omnicore-loading-band');
    Object.assign(band.style, {
      position: 'absolute',
      width: '100%',
      height: '4px',
      background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)',
      animation: 'omnicore-loading-sweep 1s linear infinite'
    });
    const text = root.querySelector('.omnicore-loading-text');
    text.style.font = '14px monospace';
    document.body.appendChild(root);
    return {
      setProgress(progress) {
        text.textContent = `Loading ${Math.round(progress)}%`;
      },
      hide() {
        root.style.opacity = '0';
        setTimeout(() => root.remove(), 190);
      }
    };
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function measureFrameSection(profiler, name, fn) {
  if (profiler?.measure) return profiler.measure(name, fn);
  return fn();
}

export default SceneManager;
