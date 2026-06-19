import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasRendererAddon, Kernel } from '../../src/index.js';
import AddonBridge from '../../src/bridge/AddonBridge.js';
import LifecycleBridge from '../../src/bridge/LifecycleBridge.js';
import OmniCoreBridge from '../../src/bridge/OmniCoreBridge.js';
import RendererBridge from '../../src/bridge/RendererBridge.js';

function createCanvasWithContext(ctx) {
  const canvas = document.createElement('canvas');
  canvas.getContext = vi.fn(() => ctx);
  return canvas;
}

describe('microkernel renderer bridge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    delete globalThis.PIXI;
  });

  it('falls back to CanvasRenderer when GPU-backed pixi initialization is unavailable', async () => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
    globalThis.PIXI = {
      Application: class {
        constructor() {
          this.view = document.createElement('canvas');
        }

        destroy() {}
      }
    };
    const canvas = document.createElement('canvas');
    canvas.getContext = vi.fn((type) => (type === '2d' ? {} : {}));
    const kernel = new Kernel();
    const bridge = new RendererBridge({
      game: { core: { canvas }, config: { width: 320, height: 180, background: '#000' } },
      kernel,
      config: {
        adapter: 'auto',
        candidates: ['pixi', 'canvas'],
        config: { requireGPU: true }
      }
    });

    const backend = await bridge.init();

    expect(backend).toBeInstanceOf(CanvasRendererAddon);
    expect(bridge.renderer.activeBackendName).toBe('canvas');
    expect(bridge.renderer.attempts).toEqual(['pixi', 'canvas']);
    expect(kernel.get('renderer:filtersEnabled')).toBe(false);
  });

  it('replays the last stored drawing commands through CanvasRenderer without pixi filters', () => {
    const ctx = {
      fillRect: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn()
    };
    const canvas = createCanvasWithContext(ctx);
    const store = {
      get: vi.fn(() => [
        { op: 'rect', x: 1, y: 2, width: 30, height: 40, color: '#f00', alpha: 0.5 },
        { op: 'text', text: 'OC', x: 8, y: 16, color: '#0ff', font: '12px monospace' }
      ])
    };
    const renderer = new CanvasRendererAddon({ canvas, store });

    renderer.init();
    renderer.replayFromStore();
    const filterResult = renderer.applyFilter('bloom');

    expect(ctx.fillRect).toHaveBeenCalledWith(1, 2, 30, 40);
    expect(ctx.fillText).toHaveBeenCalledWith('OC', 8, 16);
    expect(filterResult).toBe(false);
    expect(renderer.filtersEnabled).toBe(false);
  });

  it('keeps OmniCoreBridge as a scheduler over lifecycle, renderer, and addon bridges', async () => {
    const game = {
      config: { width: 160, height: 90, background: '#111' },
      core: { canvas: document.createElement('canvas') },
      events: { emit: vi.fn() }
    };
    const bridge = new OmniCoreBridge({
      game,
      config: {
        enabled: true,
        splash: { text: 'Bridge Boot', minDuration: 0, fadeDuration: 0, autoHide: false },
        renderer: {
          adapter: 'canvas'
        },
        addons: {
          telemetry: { init: vi.fn(), destroy: vi.fn() }
        },
        use: ['telemetry']
      }
    });

    await bridge.init();

    expect(bridge.lifecycle).toBeInstanceOf(LifecycleBridge);
    expect(bridge.rendererBridge).toBeInstanceOf(RendererBridge);
    expect(bridge.addonBridge).toBeInstanceOf(AddonBridge);
    expect(bridge.kernel.active.telemetry).toBeTruthy();
    expect(document.querySelector('[data-omnicore-splash]')?.textContent).toContain('Bridge Boot');

    await bridge.destroy();

    expect(document.querySelector('[data-omnicore-splash]')).toBeNull();
  });
});
