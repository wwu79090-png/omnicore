import { describe, expect, it, vi } from 'vitest';
import OmniCore, {
  ABTest,
  Analytics,
  AudioManager,
  EventSheet,
  HotfixManager,
  OBundle,
  OffscreenCanvasRenderer,
  PackageManager,
  Sprite,
  Timeline,
  UIElement
} from '../src/index.js';

class FakeWorker {
  constructor() {
    this.messages = [];
  }

  postMessage(message, transfer = []) {
    this.messages.push({ message, transfer });
  }

  terminate() {
    this.terminated = true;
  }
}

function createFakeAudioContext() {
  const oscillator = {
    type: 'sine',
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(() => oscillator),
    start: vi.fn(),
    stop: vi.fn()
  };
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn()
    },
    connect: vi.fn(() => gain)
  };
  return {
    currentTime: 2,
    destination: {},
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
    __oscillator: oscillator,
    __gain: gain
  };
}

describe('offscreen rendering pipeline', () => {
  it('transfers canvas control and posts serialized 2D draw commands to a worker', async () => {
    const fakeWorker = new FakeWorker();
    const offscreen = { width: 0, height: 0 };
    const canvas = {
      width: 320,
      height: 180,
      transferControlToOffscreen: vi.fn(() => offscreen)
    };
    const renderer = new OffscreenCanvasRenderer({
      canvas,
      width: 320,
      height: 180,
      workerFactory: () => fakeWorker
    });
    const scene = {
      children: [
        new Sprite('hero', { x: 8, y: 12, width: 16, height: 16, zIndex: 2 }),
        new UIElement({ x: 0, y: 0, width: 40, height: 10, zIndex: 1 }),
        {
          type: 'tilemap',
          zIndex: 0,
          tileWidth: 8,
          tileHeight: 8,
          layers: [
            { type: 'tilelayer', visible: true, width: 2, height: 1, data: [1, 2] }
          ]
        }
      ]
    };

    await renderer.init();
    renderer.renderScene(scene);

    expect(canvas.transferControlToOffscreen).toHaveBeenCalledTimes(1);
    expect(fakeWorker.messages[0]).toEqual({
      message: expect.objectContaining({ type: 'init', width: 320, height: 180, canvas: offscreen }),
      transfer: [offscreen]
    });
    expect(fakeWorker.messages[1].message.type).toBe('render');
    expect(fakeWorker.messages[1].message.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'tile' }),
      expect.objectContaining({ type: 'rect' }),
      expect.objectContaining({ type: 'sprite' })
    ]));
  });
});

describe('synthetic Web Audio effects', () => {
  it('synthesizes built-in UI and gameplay sounds without loading audio files', () => {
    const context = createFakeAudioContext();
    const audio = new AudioManager({ context });

    const node = audio.synthesize('uiClick', { volume: 0.25 });

    expect(node).toBe(context.__oscillator);
    expect(context.createOscillator).toHaveBeenCalledTimes(1);
    expect(context.createGain).toHaveBeenCalledTimes(1);
    expect(context.__oscillator.frequency.setValueAtTime).toHaveBeenCalled();
    expect(context.__gain.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    expect(context.__oscillator.start).toHaveBeenCalledWith(2);
    expect(context.__oscillator.stop).toHaveBeenCalled();
  });
});

describe('timeline branching and EventSheet behavior tree bridge', () => {
  it('selects nonlinear timeline branches from runtime state', () => {
    const calls = [];
    const timeline = new Timeline({
      events: {
        lowHp: (payload) => calls.push(payload.message),
        healthy: (payload) => calls.push(payload.message)
      }
    });

    timeline.load({
      duration: 200,
      branches: [
        {
          condition: { op: 'lt', left: 'state.hp', right: 30 },
          events: [{ time: 50, name: 'lowHp', payload: { message: 'retreat' } }]
        },
        {
          condition: { op: 'gte', left: 'state.hp', right: 30 },
          events: [{ time: 50, name: 'healthy', payload: { message: 'attack' } }]
        }
      ]
    }, { state: { hp: 12 } });

    timeline.play().update(60);

    expect(calls).toEqual(['retreat']);
  });

  it('converts EventSheet conditions and actions into BehaviorTree nodes', () => {
    const tree = EventSheet.toBehaviorTree({
      events: [
        {
          conditions: [{ op: 'gt', left: 'state.hp', right: 0 }],
          actions: [{ op: 'call', name: 'patrol' }]
        }
      ]
    });
    const calls = [];

    const status = tree.tick({
      state: { hp: 10 },
      actions: { patrol: () => calls.push('patrol') }
    });

    expect(status).toBe('success');
    expect(calls).toEqual(['patrol']);
  });
});

describe('developer ecosystem, hotfix, AB test, and analytics modules', () => {
  it('installs plugins from a REST manifest without hard-coded package metadata', async () => {
    const fetcher = vi.fn(async (url) => ({
      ok: true,
      json: async () => ({
        name: 'fps-monitor',
        version: '1.0.0',
        module: `${url}/index.js`,
        config: { debugPanel: true }
      })
    }));
    const moduleLoader = vi.fn(async () => ({ default: { install: vi.fn() } }));
    const manager = new PackageManager({ registryUrl: 'https://cdn.example.com/omni', fetcher, moduleLoader });

    const record = await manager.install('fps-monitor', { config: { plugins: [] } });

    expect(fetcher).toHaveBeenCalledWith('https://cdn.example.com/omni/packages/fps-monitor/latest');
    expect(moduleLoader).toHaveBeenCalledWith('https://cdn.example.com/omni/packages/fps-monitor/latest/index.js', expect.any(Object));
    expect(record.config.plugins).toEqual([
      expect.objectContaining({ name: 'fps-monitor', version: '1.0.0', debugPanel: true })
    ]);
  });

  it('packs assets into obundle binary payloads and loads them by key', async () => {
    const bundle = OBundle.build({
      assets: [
        { key: 'hero.json', type: 'json', data: { hp: 10 } },
        { key: 'text/readme.txt', type: 'text', data: 'hello' }
      ]
    });

    const loaded = await OBundle.load(bundle);

    expect(loaded.get('hero.json')).toEqual({ hp: 10 });
    expect(loaded.get('text/readme.txt')).toBe('hello');
  });

  it('selects ABTest variants from config by user id and rollout weights', () => {
    const abtest = ABTest.fromJSON({
      experiments: {
        rendererMode: {
          variants: [
            { id: 'control', weight: 50, config: { renderer: 'canvas' } },
            { id: 'offscreen', weight: 50, config: { renderer: 'offscreen' } }
          ]
        }
      }
    });

    const first = abtest.select('rendererMode', { userId: 'player-001' });
    const second = abtest.select('rendererMode', { userId: 'player-001' });

    expect(first).toEqual(second);
    expect(['control', 'offscreen']).toContain(first.id);
    expect(first.config).toHaveProperty('renderer');
  });

  it('applies hotfix JSON to scenes and functions on demand', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        version: '2026.06.18',
        scenes: { boot: { title: 'Patched' } },
        functions: {
          computeScore: 'return input.score * 2;'
        }
      })
    }));
    const runtime = {
      scenes: { boot: { title: 'Old' } },
      functions: { computeScore: () => 0 }
    };
    const hotfix = new HotfixManager({ url: '/config/hotfix.json', fetcher, runtime });

    const patch = await hotfix.checkNow();

    expect(patch.version).toBe('2026.06.18');
    expect(runtime.scenes.boot.title).toBe('Patched');
    expect(runtime.functions.computeScore({ score: 7 })).toBe(14);
  });

  it('tracks analytics events with device, fps, scene, and JSON transport payloads', async () => {
    const transport = vi.fn(async () => ({ ok: true }));
    const analytics = new Analytics({
      transport,
      device: { platform: 'web' },
      fpsProvider: () => 59,
      sceneProvider: () => 'battle'
    });

    const event = analytics.track('level_start', { id: 'stage-1' });
    await analytics.flush();

    expect(event).toMatchObject({
      name: 'level_start',
      payload: { id: 'stage-1' },
      context: { fps: 59, scene: 'battle', device: { platform: 'web' } }
    });
    expect(transport).toHaveBeenCalledWith(JSON.stringify([event]));
  });

  it('exports new commercial runtime modules from OmniCore namespace', () => {
    expect(typeof OffscreenCanvasRenderer).toBe('function');
    expect(typeof PackageManager).toBe('function');
    expect(typeof ABTest).toBe('function');
    expect(typeof HotfixManager).toBe('function');
    expect(typeof Analytics).toBe('function');
    expect(typeof OBundle.build).toBe('function');
    expect(OmniCore.OffscreenCanvasRenderer).toBe(OffscreenCanvasRenderer);
    expect(OmniCore.PackageManager).toBe(PackageManager);
    expect(OmniCore.OBundle).toBe(OBundle);
    expect(OmniCore.ABTest).toBe(ABTest);
    expect(OmniCore.HotfixManager).toBe(HotfixManager);
    expect(OmniCore.Analytics).toBe(Analytics);
  });
});
