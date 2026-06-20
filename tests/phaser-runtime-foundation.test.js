import { describe, expect, it, vi } from 'vitest';
import {
  Game,
  PixiRenderer,
  Scene,
  SceneManager,
  detectPlatformAndMergeDefaults
} from '../src/index.js';

describe('Phaser runtime foundation expectations', () => {
  it('runs overlay scenes without blocking the main scene and dismisses them by id', async () => {
    const updates = [];
    const renders = [];
    const game = {
      loop: { subscribe: () => () => {} },
      renderer: { renderScene: vi.fn((scene) => renders.push(scene?.name)) },
      input: null,
      camera: null,
      timer: null,
      events: { emit: vi.fn() }
    };
    const manager = new SceneManager(game);
    manager.register('main', new Scene('main'));
    manager.register('hud', new Scene('hud'));
    manager.registry.get('main').update = () => updates.push('main');
    manager.registry.get('hud').update = () => updates.push('hud');

    await manager.push('main');
    const overlay = await manager.overlay('pause-hud', 'hud');
    manager.update(1 / 60, 16);
    const dismissed = manager.dismiss('pause-hud');
    manager.update(1 / 60, 32);

    expect(overlay.name).toBe('hud');
    expect(dismissed.name).toBe('hud');
    expect(updates).toEqual(['main', 'hud', 'main']);
    expect(renders).toEqual(expect.arrayContaining(['main', 'hud']));
    expect(manager.overlays.size).toBe(0);
  });

  it('captures renderer pixels from canvas backends for reflections and screenshots', () => {
    const imageData = { width: 16, height: 12, data: new Uint8ClampedArray(16 * 12 * 4) };
    const ctx = {
      getImageData: vi.fn(() => imageData)
    };
    const renderer = new PixiRenderer({
      backend: 'canvas',
      width: 320,
      height: 180,
      canvas: { getContext: () => ctx }
    });
    renderer.ctx = ctx;

    const capture = renderer.capture(4, 8, 16, 12);

    expect(capture).toBe(imageData);
    expect(ctx.getImageData).toHaveBeenCalledWith(4, 8, 16, 12);
  });

  it('merges platform defaults before Game modules are constructed', () => {
    const wechat = detectPlatformAndMergeDefaults({ renderer: 'pixi' }, {
      platform: 'wechat',
      isWechat: true,
      isMiniGame: true
    });
    const electron = detectPlatformAndMergeDefaults({ framerateCap: 144 }, {
      platform: 'electron',
      isElectron: true
    });

    expect(wechat).toMatchObject({
      platform: 'wechat',
      renderer: 'canvas',
      framerateCap: 30,
      pausedOnHidden: true
    });
    expect(electron).toMatchObject({
      platform: 'electron',
      renderer: 'pixi',
      framerateCap: 144,
      pausedOnHidden: true
    });
  });

  it('exposes a Game-bound pool facade and releases pooled memory with lifecycle cleanup', () => {
    const game = new Game({
      renderer: 'canvas',
      pool: {
        bullet: {
          size: 2,
          factory: (slot) => ({ slot, active: true }),
          reset: (item) => { item.active = false; }
        }
      }
    });

    const first = game.pool.get('bullet');
    const second = game.pool.get('bullet');
    game.pool.release(first);
    const reused = game.pool.get('bullet');
    game.pool.releaseAll();

    expect(second.slot).toBe(1);
    expect(reused.slot).toBe(0);
    expect(first.active).toBe(false);
    expect(game.pool.stats('bullet')).toMatchObject({ active: 0, available: 2 });
  });

  it('maps pausedOnHidden to Loop autoPause and allows idle games to keep running hidden', () => {
    const defaultGame = new Game({ renderer: 'canvas' });
    const idleGame = new Game({ renderer: 'canvas', pausedOnHidden: false });

    expect(defaultGame.config.pausedOnHidden).toBe(true);
    expect(defaultGame.loop.autoPause).toBe(true);
    expect(idleGame.config.pausedOnHidden).toBe(false);
    expect(idleGame.loop.autoPause).toBe(false);
  });
});
