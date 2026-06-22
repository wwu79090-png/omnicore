import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import OmniCore, {
  AdaptiveQualityManager,
  ComputeRuntime,
  DeviceProfiler,
  EditorPanel,
  Kernel,
  NetManager,
  PluginRecommendationEngine,
  SceneManager,
  Store,
  TelemetryCollector,
  TelemetryDashboard,
  ViewportCulling,
  WasmLoader
} from '../src/index.js';

class FakeDatagramWriter {
  constructor() {
    this.writes = [];
  }

  async write(payload) {
    this.writes.push(payload);
  }

  releaseLock() {}
}

class FakeWebTransport {
  constructor(url) {
    this.url = url;
    this.ready = Promise.resolve();
    this.closed = new Promise(() => {});
    this.writer = new FakeDatagramWriter();
    this.datagrams = {
      writable: {
        getWriter: () => this.writer
      },
      readable: {
        getReader: () => ({
          read: async () => ({ done: true }),
          releaseLock() {}
        })
      }
    };
    this.closedByClient = false;
  }

  close() {
    this.closedByClient = true;
  }
}

describe('developer ecosystem intelligent systems', () => {
  it('collects API usage only in debug mode and renders trends plus heatmap', async () => {
    const disabled = new TelemetryCollector({ debug: false });
    disabled.recordApi('Store.set', { duration: 1 });
    expect(disabled.snapshot().apiUsage).toEqual({});

    const collector = new TelemetryCollector({ debug: true, clock: () => 100 });
    collector.recordApi('Store.set', { duration: 3, configPath: 'state.score' });
    collector.recordApi('Store.set', { duration: 7, configPath: 'state.score' });
    collector.recordError('Store.set', new Error('bad config'), { configPath: 'state.score' });

    const dashboard = new TelemetryDashboard({ debug: true, collector });
    dashboard.attach(document.body);
    dashboard.refresh();

    const snapshot = collector.snapshot();
    expect(snapshot.apiUsage['Store.set'].count).toBe(2);
    expect(snapshot.apiUsage['Store.set'].avgDuration).toBe(5);
    expect(snapshot.errors[0].configPath).toBe('state.score');
    expect(document.querySelector('[data-omnicore-telemetry-dashboard]')?.textContent).toContain('Store.set');
    expect(document.querySelector('[data-omnicore-telemetry-heatmap="Store.set"]')).not.toBeNull();

    const game = await new OmniCore.Game({
      headless: true,
      autoStart: false,
      debug: true,
      editorPanel: false,
      logForwarder: false,
      adaptiveQuality: false
    }).init();
    game.store.set('score', 1);
    expect(game.telemetryCollector.snapshot().apiUsage['Store.set'].count).toBeGreaterThanOrEqual(1);
    game.destroy();

    const releaseGame = await new OmniCore.Game({
      headless: true,
      autoStart: false,
      debug: false,
      adaptiveQuality: false
    }).init();
    expect(releaseGame.telemetryCollector).toBeNull();
    releaseGame.destroy();

    dashboard.detach();
  });

  it('sorts docs homepage by telemetry frequency and emits tutorial gaps', () => {
    mkdirSync('docs/release-notes', { recursive: true });
    writeFileSync('docs/release-notes/telemetry-insights.json', JSON.stringify({
      apiUsage: {
        'Kernel.use': { count: 9, avgDuration: 1 },
        'Renderer.drawRect': { count: 4, avgDuration: 2 }
      }
    }, null, 2));

    execFileSync(process.execPath, ['scripts/docs.js'], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });

    const api = readFileSync('docs/api.md', 'utf8');
    const gaps = readFileSync('docs/tutorial-gaps.md', 'utf8');

    expect(api).toContain('## 高频 API');
    expect(api.indexOf('Kernel.use')).toBeLessThan(api.indexOf('Renderer.drawRect'));
    expect(gaps).toContain('教程缺失区');
    expect(gaps).toContain('Renderer.drawRect');
  });

  it('recommends plugins from entity attributes and displays editor entry points', () => {
    const engine = new PluginRecommendationEngine();
    const entity = {
      id: 'enemy',
      type: 'sprite',
      health: 10,
      velocity: { x: 1, y: 0 },
      x: 0,
      y: 0,
      width: 16,
      height: 16
    };

    expect(engine.recommend(entity).map((item) => item.plugin)).toEqual(expect.arrayContaining([
      'ParticleOnHit',
      'PhysicsBody'
    ]));

    const store = new Store();
    const game = {
      store,
      scene: { current: { name: 'test', children: [entity] } },
      renderer: { renderScene: vi.fn() }
    };
    const panel = new EditorPanel(game, { recommendationEngine: engine });
    panel.attach();
    panel.select(entity);

    const recommendations = store.get('editor:pluginRecommendations');
    expect(recommendations.map((item) => item.plugin)).toContain('ParticleOnHit');
    expect(document.querySelector('[data-plugin-recommendation="ParticleOnHit"]')).not.toBeNull();
    panel.detach();
  });
});

describe('next generation web runtime systems', () => {
  it('uses WebAssembly.instantiate for damage and A* heuristic with JS fallback', async () => {
    const loader = new WasmLoader({
      instantiate: async () => ({
        instance: {
          exports: {
            damage: () => 42,
            manhattan: () => 2
          }
        }
      })
    });
    const runtime = new ComputeRuntime({ wasmLoader: loader });
    await runtime.init();

    expect(runtime.damage({ base: 10, attack: 5, defense: 3 })).toBe(42);
    expect(runtime.findPath({
      start: { x: 0, y: 0 },
      goal: { x: 2, y: 0 },
      grid: [[0, 0, 0]]
    })).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
    expect(loader.loaded).toBe(true);

    const fallback = new ComputeRuntime({ wasmLoader: null });
    await fallback.init();
    expect(fallback.damage({ base: 10, attack: 4, defense: 2, multiplier: 1.5 })).toBe(18);
  });

  it('creates unstable WebTransport connections behind the existing Net abstraction', async () => {
    const net = new NetManager({ WebTransportClass: FakeWebTransport });
    const connection = await net.connect('https://example.test/game', {
      transport: 'webtransport',
      retryLimit: 2
    });

    await connection.send({ type: 'move', x: 1 }, { reliable: true });

    expect(connection.transport).toBe('webtransport');
    expect(connection.unstable).toBe(true);
    expect(connection.pendingAcks.size).toBe(1);
    expect(connection.writer.writes).toHaveLength(1);
    connection.close();
  });
});

describe('microkernel contracts and self-optimizing runtime', () => {
  it('negotiates addon resource contracts internally and lowers physics sampling when renderer is busy', () => {
    const physics = {
      contract: {
        requestAnimationFrame: { priority: 'high', samplingRate: 60 }
      },
      onContractUpdate: vi.fn()
    };
    const renderer = {
      negotiateAddonContract: vi.fn(() => ({ status: 'busy', samplingRateScale: 0.5 }))
    };
    const kernel = new Kernel();

    kernel.addon('physics', physics).attachRenderer(renderer).use('physics');

    expect(renderer.negotiateAddonContract).toHaveBeenCalledWith(expect.objectContaining({
      requestAnimationFrame: expect.objectContaining({ samplingRate: 60 })
    }), expect.objectContaining({ addonName: 'physics' }));
    expect(physics.samplingRate).toBe(30);
    expect(physics.__omnicoreContract.status).toBe('busy');
    expect(physics.onContractUpdate).toHaveBeenCalled();
  });

  it('profiles weak devices and only degrades rendering plus particle quality', async () => {
    const profiler = new DeviceProfiler({
      durationMs: 0,
      gpuTask: () => 1,
      cpuTask: () => 1,
      memoryTask: () => 1
    });
    const profile = await profiler.profile();
    const renderer = {
      enableBloom: true,
      particleLimit: 1000,
      setQualityProfile: vi.fn()
    };
    const culling = new ViewportCulling();
    const manager = new AdaptiveQualityManager({
      renderer,
      culling,
      particleScale: 0.4,
      maxVisibleTileChunks: 4
    });

    const result = manager.apply(profile);

    expect(profile.tier).toBe('low');
    expect(result.applied).toContain('disableBloom');
    expect(renderer.enableBloom).toBe(false);
    expect(renderer.particleLimit).toBe(400);
    expect(culling.maxVisibleTileChunks).toBe(4);
    expect(renderer.setQualityProfile).toHaveBeenCalledWith(expect.objectContaining({ tier: 'low' }));
  });

  it('applies mobile low-power and thermal signals to loop rate and texture quality', () => {
    const store = new Store();
    const renderer = {
      enableBloom: true,
      particleLimit: 1000,
      textureQuality: 1,
      setQualityProfile: vi.fn()
    };
    const loop = { fps: 60, frameMs: 1000 / 60 };
    const manager = new AdaptiveQualityManager({
      renderer,
      loop,
      store,
      lowPowerFps: 30,
      lowPowerTextureQuality: 0.5
    });

    const result = manager.applyPowerState({
      lowPowerMode: true,
      batteryLevel: 0.12,
      thermalState: 'serious'
    });

    expect(result.applied).toEqual(expect.arrayContaining([
      'reduceLoopFps',
      'reduceTextureQuality',
      'disableBloom'
    ]));
    expect(loop.fps).toBe(30);
    expect(loop.frameMs).toBeCloseTo(1000 / 30, 4);
    expect(renderer.textureQuality).toBe(0.5);
    expect(store.get('device:powerState')).toMatchObject({
      lowPowerMode: true,
      batteryLevel: 0.12,
      thermalState: 'serious'
    });
  });

  it('does not reduce loop FPS on low-power signals unless lowPowerFps is explicit', () => {
    const renderer = {
      enableBloom: true,
      textureQuality: 1,
      setQualityProfile: vi.fn()
    };
    const loop = { fps: null, frameMs: 0, framerateCap: null, uncapped: true };
    const manager = new AdaptiveQualityManager({
      renderer,
      loop,
      lowPowerTextureQuality: 0.5
    });

    const result = manager.applyPowerState({ lowPowerMode: true });

    expect(result.applied).not.toContain('reduceLoopFps');
    expect(loop).toMatchObject({ fps: null, framerateCap: null, uncapped: true });
    expect(result.applied).toEqual(expect.arrayContaining(['reduceTextureQuality', 'disableBloom']));
  });

  it('hard-maintains target FPS by escalating non-core runtime degradation', () => {
    const store = new Store();
    const renderer = {
      enableBloom: true,
      filtersEnabled: true,
      particleLimit: 1000,
      setQualityProfile: vi.fn()
    };
    const culling = new ViewportCulling({ padding: 64 });
    const particle = {
      id: 'dust',
      kind: 'particle',
      visible: true,
      active: true,
      physics: { enabled: true },
      body: { enabled: true }
    };
    const hero = {
      id: 'hero',
      kind: 'player',
      critical: true,
      visible: true,
      active: true,
      physics: { enabled: true },
      body: { enabled: true }
    };
    const manager = new AdaptiveQualityManager({
      renderer,
      culling,
      store,
      hardMaintain: true,
      targetFps: 30,
      lowFpsFrames: 1,
      particleScale: 0.5,
      maxVisibleTileChunks: 4
    });

    const first = manager.observeFrame({ fps: 24, scene: { children: [particle, hero] } });
    const second = manager.observeFrame({ fps: 22, scene: { children: [particle, hero] } });

    expect(first).toMatchObject({
      triggered: true,
      level: 1,
      applied: expect.arrayContaining(['disableBloom', 'disableFilters', 'reduceParticles', 'tightenCulling'])
    });
    expect(second).toMatchObject({
      triggered: true,
      level: 2,
      applied: expect.arrayContaining(['suspendNonCoreEntities'])
    });
    expect(renderer.enableBloom).toBe(false);
    expect(renderer.filtersEnabled).toBe(false);
    expect(renderer.particleLimit).toBe(500);
    expect(culling.padding).toBe(0);
    expect(culling.maxVisibleTileChunks).toBe(4);
    expect(particle.visible).toBe(false);
    expect(particle.active).toBe(false);
    expect(particle.__omnicoreSkipUpdate).toBe(true);
    expect(particle.__omnicoreSkipPhysics).toBe(true);
    expect(particle.physics.enabled).toBe(false);
    expect(particle.body.enabled).toBe(false);
    expect(hero.visible).toBe(true);
    expect(hero.active).toBe(true);
    expect(hero.physics.enabled).toBe(true);
    expect(store.get('renderer:targetFpsHardMaintain')).toMatchObject({
      active: true,
      level: 2,
      targetFps: 30
    });
  });

  it('feeds scene frame telemetry into adaptive quality hard-maintain mode', () => {
    const observeFrame = vi.fn();
    const scene = {
      children: [{ id: 'hero' }],
      update: vi.fn()
    };
    const game = {
      input: { update: vi.fn() },
      camera: { update: vi.fn() },
      renderer: { renderScene: vi.fn(), backend: 'canvas' },
      performanceMonitor: { updateFromGame: vi.fn() },
      adaptiveQualityManager: { observeFrame },
      culling: new ViewportCulling(),
      sleepWake: null,
      store: new Store()
    };
    const manager = new SceneManager(game);
    manager.stack.push(scene);

    manager.update(1 / 24, 100);

    expect(observeFrame).toHaveBeenCalledWith(expect.objectContaining({
      fps: 24,
      scene,
      renderer: game.renderer,
      culling: game.culling,
      store: game.store,
      reason: 'frame'
    }));
  });
});
