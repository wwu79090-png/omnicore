import { describe, expect, it, vi } from 'vitest';
import {
  AssetCache,
  CharacterRig,
  Game
} from '../src/index.js';

describe('AssetCache', () => {
  it('loads, preloads, gets, and releases Pixi assets by stable game keys', async () => {
    const texture = { id: 'hero-texture', destroy: vi.fn() };
    const assets = {
      loaded: new Map(),
      load: vi.fn(async (url) => {
        assets.loaded.set(url, texture);
        return texture;
      }),
      get: vi.fn((key) => assets.loaded.get(key)),
      unload: vi.fn(async () => true)
    };
    const cache = new AssetCache({ assets });

    await expect(cache.load('hero', '/sprites/hero.png')).resolves.toBe(texture);
    await expect(cache.preload({ enemy: '/sprites/enemy.png' })).resolves.toMatchObject({ enemy: texture });

    expect(cache.get('hero')).toBe(texture);
    expect(await cache.release('hero')).toBe(true);
    expect(assets.unload).toHaveBeenCalledWith('/sprites/hero.png');
    expect(texture.destroy).toHaveBeenCalledWith(false);
  });

  it('returns a reusable 64x64 blue placeholder texture when get misses', () => {
    const cache = new AssetCache({ assets: { get: vi.fn() } });
    const missing = cache.get('missing');

    expect(missing.width).toBe(64);
    expect(missing.height).toBe(64);
    expect(missing.label).toBe('omnicore:placeholder:blue');
    expect(missing.__omnicorePlaceholder).toBe(true);
    expect(missing.__omnicorePlaceholderColor).toBe('rgba(37,99,235,1)');
    expect(cache.get('still-missing')).toBe(missing);
  });

  it('mounts AssetCache on every Game instance as game.cache', () => {
    const game = new Game({ headless: true, autoStart: false });

    expect(game.cache).toBeInstanceOf(AssetCache);
    expect(game.cache.get('missing').width).toBe(64);

    game.destroy();
  });
});

describe('CharacterRig', () => {
  it('adds rig sprites in strict backArm -> body -> head -> frontArm z-order', () => {
    const cache = new AssetCache();
    const rig = new CharacterRig({
      cache,
      anchor: { x: 0.5, y: 0.9 },
      assetMap: {
        backArm: 'back-arm',
        body: 'body',
        head: 'head',
        frontArm: 'front-arm'
      }
    });

    expect(rig.container.children.map((sprite) => sprite.label)).toEqual(['backArm', 'body', 'head', 'frontArm']);
    expect(rig.parts.body.anchor.x).toBe(0.5);
    expect(rig.parts.body.anchor.y).toBe(0.9);
  });

  it('moves the container through setPosition and animates idle/walk states with tweens', () => {
    const rig = new CharacterRig({
      cache: new AssetCache(),
      assetMap: {
        backArm: 'back-arm',
        body: 'body',
        head: 'head',
        frontArm: 'front-arm'
      }
    });

    rig.setPosition(120, 240);
    expect(rig.container.x).toBe(120);
    expect(rig.container.y).toBe(240);

    rig.state = 'walk';
    rig.update(0.13);

    expect(rig.state).toBe('walk');
    expect(rig.parts.body.y).toBeLessThan(0);
    expect(rig.parts.backArm.rotation).toBeGreaterThan(0);

    rig.state = 'idle';
    rig.update(0.45);

    expect(rig.state).toBe('idle');
    expect(Math.abs(rig.parts.head.rotation)).toBeGreaterThan(0);
  });
});
