import { afterEach, describe, expect, it, vi } from 'vitest';
import OmniCore from '../src/index.js';
import Loader from '../src/loader/Loader.js';
import Scene from '../src/scene/Scene.js';

describe('Loader path resolver resilience', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tries configured fallback texture paths only after the original URL fails', async () => {
    const calls = [];
    const loader = new Loader({
      retries: 0,
      fetcher: async (url) => {
        calls.push(url);
        return {
          ok: url === './textures/player.png',
          status: url === './textures/player.png' ? 200 : 404,
          text: async () => 'fallback-player'
        };
      }
    });

    const bundle = await loader.loadBundle([{ key: 'player', url: '/wrong/player.png', type: 'text' }]);

    expect(calls).toEqual([
      '/wrong/player.png',
      'public/assets/textures/player.png',
      './textures/player.png'
    ]);
    expect(bundle.player).toBe('fallback-player');
  });

  it('returns a ResourceMissing placeholder and logs a stable error when all paths fail', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const friendly = vi.fn();
    const loader = new Loader({
      retries: 0,
      onFriendlyError: friendly,
      fetcher: async () => ({
        ok: false,
        status: 404,
        text: async () => ''
      })
    });

    const bundle = await loader.loadBundle([{ key: 'player', url: '/missing/player.png', type: 'blob', width: 48, height: 32 }]);

    expect(bundle.player).toEqual(expect.objectContaining({
      type: 'ResourceMissing',
      fallback: true,
      alpha: 0.5,
      color: 'rgba(255,0,0,0.5)',
      width: 48,
      height: 32
    }));
    expect(error).toHaveBeenCalledWith('资源丢失，请检查路径配置', expect.any(Object));
    expect(friendly).toHaveBeenCalledWith(expect.objectContaining({ name: 'FriendlyLoadError' }));
  });
});

describe('scene loading barrier', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('creates a top canvas transition layer during Game init', async () => {
    const game = await new OmniCore.Game({
      renderer: 'canvas',
      autoStart: false,
      autoAttach: false
    }).init();

    expect(game.transitionLayer.root.dataset.omnicoreTransitionLayer).toBe('true');
    expect(game.transitionLayer.root.style.zIndex).toBe('2147483647');
    expect(game.transitionLayer.root.style.display).toBe('none');

    game.destroy();
  });

  it('blocks scene activation behind Loader.loadBundle and then hides the barrier', async () => {
    vi.useFakeTimers();
    const events = [];
    const game = await new OmniCore.Game({
      renderer: 'canvas',
      autoStart: false,
      autoAttach: false
    }).init();
    game.loader.loadBundle = vi.fn(async () => ({ boot: { ok: true } }));
    const scene = new Scene('boot');
    scene.create = vi.fn(() => events.push('create'));
    game.scene.register(scene);

    const loading = game.scene.load('boot', {
      bundle: [{ key: 'boot', url: '/boot.json', type: 'json' }]
    });

    expect(game.transitionLayer.root.style.display).toBe('grid');
    expect(game.transitionLayer.root.textContent).toContain('正在编译世界...');

    await loading;
    await vi.advanceTimersByTimeAsync(220);

    expect(game.loader.loadBundle).toHaveBeenCalledWith([{ key: 'boot', url: '/boot.json', type: 'json' }], {});
    expect(events).toEqual(['create']);
    expect(game.scene.current).toBe(scene);
    expect(game.transitionLayer.root.style.display).toBe('none');

    game.destroy();
    vi.useRealTimers();
  });
});

describe('debug EmergencyOverlay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('is only attached for debug games and renders persistent fatal error actions', async () => {
    const releaseGame = await new OmniCore.Game({
      renderer: 'canvas',
      autoStart: false,
      autoAttach: false,
      debug: false
    }).init();
    expect(releaseGame.emergencyOverlay).toBeNull();
    releaseGame.destroy();

    const game = await new OmniCore.Game({
      renderer: 'canvas',
      autoStart: false,
      autoAttach: false,
      debug: true
    }).init();

    game.events.emit('error', {
      message: 'Store中的hp字段未初始化。请检查配置或重置Store。',
      source: 'Store',
      line: 34
    });

    const overlay = document.querySelector('[data-omnicore-emergency]');
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toContain('[OmniCore 致命错误] 第34行：Store中的hp字段未初始化。请检查配置或重置Store。');
    expect(overlay.textContent).toContain('继续运行');
    expect(overlay.textContent).toContain('关闭');

    overlay.querySelector('[data-action="continue"]').click();
    expect(overlay.style.display).toBe('none');

    game.events.emit('warning', {
      message: '资源路径即将废弃。',
      source: 'Loader',
      line: 12
    });
    expect(overlay.style.display).toBe('flex');
    overlay.querySelector('[data-action="close"]').click();
    expect(document.querySelector('[data-omnicore-emergency]')).toBeNull();

    game.destroy();
  });
});
