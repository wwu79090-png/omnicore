import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AudioManager, Loader, ProfilerSnapshot } from '../src/index.js';
import { buildRegistryGuidance, inspectNpmRegistry } from '../scripts/pre-install-check.js';
import { buildHeatmapSvg, compareVisualResults } from '../scripts/visual-regression.js';

describe('browser asset cache and texture predecode', () => {
  it('writes image assets into Cache API and skips duplicate network downloads on later warmups', async () => {
    const puts = [];
    const cache = {
      match: vi.fn(async (request) => (request.url.endsWith('hero.webp') ? { cached: true } : null)),
      put: vi.fn(async (request, response) => puts.push({ request, response }))
    };
    const caches = { open: vi.fn(async () => cache) };
    const fetcher = vi.fn(async (url) => ({ ok: true, url, clone: () => ({ clonedFrom: url }) }));
    const loader = new Loader({ fetcher, caches });

    const report = await loader.cacheAssets([
      { key: 'hero', url: '/assets/hero.webp', type: 'image' },
      { key: 'tiles', url: '/assets/tiles.webp', type: 'image' }
    ]);

    expect(caches.open).toHaveBeenCalledWith('omnicore-assets-v1');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/assets/tiles.webp', expect.any(Object));
    expect(puts).toHaveLength(1);
    expect(report).toEqual({
      cacheName: 'omnicore-assets-v1',
      cached: ['/assets/hero.webp'],
      fetched: ['/assets/tiles.webp'],
      failed: []
    });
  });

  it('predecodes textures during idle time before gameplay needs them', async () => {
    const idleCallbacks = [];
    const image = { src: '', decoding: 'async', decode: vi.fn(async () => undefined) };
    const loader = new Loader({
      scheduleIdle: (callback) => idleCallbacks.push(callback),
      imageFactory: () => image
    });

    const promise = loader.predecodeTextures([{ url: '/assets/next-level.webp' }]);
    expect(idleCallbacks).toHaveLength(1);
    idleCallbacks[0]();
    const report = await promise;

    expect(image.src).toBe('/assets/next-level.webp');
    expect(image.decode).toHaveBeenCalledTimes(1);
    expect(report.decoded).toEqual(['/assets/next-level.webp']);
    expect(report.failed).toEqual([]);
  });
});

describe('npm install guidance for China registry conditions', () => {
  it('detects npmjs timeout and prints a one-command npmmirror fix', async () => {
    const result = await inspectNpmRegistry({
      registry: 'https://registry.npmjs.org/',
      ping: async () => {
        throw Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' });
      }
    });

    expect(result.needsMirrorHint).toBe(true);
    expect(result.command).toBe('npm config set registry https://registry.npmmirror.com/');
    expect(buildRegistryGuidance(result)).toContain('npm config set registry https://registry.npmmirror.com/');
  });
});

describe('audio compressor limiter chain', () => {
  it('routes overlapping sound effects through a DynamicsCompressor before destination', () => {
    const destination = { name: 'destination' };
    const compressor = {
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 },
      connect: vi.fn()
    };
    const gain = { gain: { value: 1, setValueAtTime: vi.fn() }, connect: vi.fn() };
    const source = { connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    const context = {
      currentTime: 0,
      destination,
      createDynamicsCompressor: vi.fn(() => compressor),
      createGain: vi.fn(() => gain),
      createBufferSource: vi.fn(() => source)
    };
    const audio = new AudioManager({ context });
    audio.buffers.set('boom', { duration: 1 });

    for (let index = 0; index < 50; index += 1) audio.play('boom', { volume: 1 });

    expect(context.createDynamicsCompressor).toHaveBeenCalledTimes(1);
    expect(compressor.threshold.value).toBe(-12);
    expect(compressor.ratio.value).toBe(12);
    expect(compressor.connect).toHaveBeenCalledWith(destination);
    expect(gain.connect).toHaveBeenCalledWith(compressor);
    expect(source.start).toHaveBeenCalledTimes(50);
  });
});

describe('runtime memory snapshot profiler', () => {
  it('captures entities and components sorted by estimated memory usage', () => {
    const scene = {
      current: {
        children: [
          { id: 'small', components: [{ name: 'Transform', x: 1, y: 2 }] },
          { id: 'large', components: [{ name: 'Inventory', items: new Array(20).fill('potion') }] }
        ]
      }
    };

    const snapshot = ProfilerSnapshot.capture({ scene });

    expect(snapshot.schema).toBe('OmniCore.Profiler.Snapshot/v1');
    expect(snapshot.entityCount).toBe(2);
    expect(snapshot.entities[0].id).toBe('large');
    expect(snapshot.entities[0].components[0]).toEqual(expect.objectContaining({
      name: 'Inventory',
      estimatedBytes: expect.any(Number)
    }));
  });

  it('binds F2 in debug mode and stores the latest profiler snapshot on the game', () => {
    const listeners = new Map();
    const ownerWindow = {
      addEventListener: vi.fn((type, handler) => listeners.set(type, handler)),
      removeEventListener: vi.fn()
    };
    const game = {
      config: { debug: true },
      scene: { current: { children: [{ id: 'hero', components: [{ name: 'Health', hp: 10 }] }] } },
      events: { emit: vi.fn() }
    };

    const binding = ProfilerSnapshot.installDebugShortcut(game, { window: ownerWindow });
    listeners.get('keydown')({ key: 'F2', preventDefault: vi.fn() });

    expect(game.profilerSnapshot.latest.entityCount).toBe(1);
    expect(game.events.emit).toHaveBeenCalledWith('profiler:snapshot', game.profilerSnapshot.latest);
    binding.destroy();
    expect(ownerWindow.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});

describe('visual regression heatmap reporting', () => {
  it('generates a heatmap artifact and attaches it to failed visual diff results', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'omnicore-visual-'));
    const report = compareVisualResults({
      examples: [{ name: 'hero-offset', width: 4, height: 4, diffPixels: [{ x: 1, y: 2 }, { x: 2, y: 2 }] }],
      threshold: 0.01,
      outDir: tmp,
      generatedAt: '2026-06-20T00:00:00.000Z'
    });

    expect(report.pass).toBe(false);
    expect(report.results[0]).toEqual(expect.objectContaining({
      pass: false,
      diffRatio: 0.125,
      heatmap: expect.stringMatching(/hero-offset-diff-heatmap\.svg$/)
    }));
    expect(fs.readFileSync(report.results[0].heatmap, 'utf8')).toContain('data-diff-pixel="1,2"');
    expect(buildHeatmapSvg({ width: 2, height: 2, diffPixels: [{ x: 0, y: 0 }] })).toContain('<svg');
  });
});
