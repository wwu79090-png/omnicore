import { afterEach, describe, expect, it, vi } from 'vitest';
import OmniCore, {
  Container,
  Game,
  InputManager,
  Loader,
  Sprite
} from '../src/index.js';

describe('required OmniCore foundation APIs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('exposes Container with addChild and independent world positions', () => {
    const root = new Container({ x: 100, y: 40 });
    const floor = new Container({ x: 24, y: 12 });
    const marker = new Container({ x: 5, y: 7 });

    root.addChild(floor);
    floor.addChild(marker);

    expect(OmniCore.Container).toBe(Container);
    expect(floor.parent).toBe(root);
    expect(marker.getWorldPosition()).toEqual({ x: 129, y: 59 });
    expect(floor.removeChild(marker)).toBe(marker);
    expect(marker.parent).toBeNull();
  });

  it('lets Sprite.setFrame switch atlas frame metadata and texture', () => {
    const sprite = new Sprite('characters.png', {
      atlas: {
        texture: 'characters.png',
        frames: {
          idle: { frame: { x: 0, y: 0, w: 32, h: 48 } },
          run: { texture: 'characters-run.png', x: 32, y: 0, width: 40, height: 48 }
        }
      }
    });

    expect(sprite.setFrame('idle')).toBe(sprite);
    expect(sprite.texture).toBe('characters.png');
    expect(sprite.frameName).toBe('idle');
    expect(sprite.sourceFrame).toMatchObject({ x: 0, y: 0, width: 32, height: 48 });
    expect(sprite.width).toBe(32);

    sprite.setFrame('run');
    expect(sprite.texture).toBe('characters-run.png');
    expect(sprite.sourceFrame).toMatchObject({ x: 32, y: 0, width: 40, height: 48 });
    expect(sprite.height).toBe(48);
  });

  it('applies Game scaleMode FIT, CENTER, and HEIGHT canvas layout modes', () => {
    const fit = createScaleModeGame('FIT', 3840, 2160);
    expect(fit.canvas.style.width).toBe('3840px');
    expect(fit.canvas.style.height).toBe('2160px');
    fit.game.destroy();

    const center = createScaleModeGame('CENTER', 3840, 2160);
    expect(center.canvas.style.width).toBe('1920px');
    expect(center.canvas.style.height).toBe('1080px');
    expect(center.canvas.style.marginLeft).toBe('960px');
    expect(center.canvas.style.marginTop).toBe('540px');
    center.game.destroy();

    const height = createScaleModeGame('HEIGHT', 3000, 2160);
    expect(height.canvas.style.width).toBe('3840px');
    expect(height.canvas.style.height).toBe('2160px');
    height.game.destroy();
  });

  it('locks browser gestures and text selection on Input canvas targets by default', () => {
    const canvas = document.createElement('canvas');
    const input = new InputManager({ target: canvas });

    expect(canvas.style.touchAction).toBe('none');
    expect(canvas.style.userSelect).toBe('none');
    expect(canvas.style.webkitUserSelect).toBe('none');

    input.destroy();
  });

  it('downgrades file protocol loads to no-cors and resolves Base64 inline assets', async () => {
    const fetcher = vi.fn(async (url, options) => ({
      ok: true,
      text: async () => `${options.mode}:${url}`
    }));
    const loader = new Loader({ fetcher, preferWebp: false });

    await expect(loader.loadBundle([
      { key: 'localText', url: 'file:///project/assets/local.txt', type: 'text' }
    ])).resolves.toMatchObject({
      localText: 'no-cors:file:///project/assets/local.txt'
    });
    expect(fetcher).toHaveBeenCalledWith(
      'file:///project/assets/local.txt',
      expect.objectContaining({ mode: 'no-cors' })
    );

    const inline = new Loader({ fetcher: vi.fn(), preferWebp: false });
    const json = Buffer.from(JSON.stringify({ ok: true, source: 'base64' })).toString('base64');
    await expect(inline.loadBundle([
      { key: 'inlineJson', url: 'file:///project/assets/config.json', type: 'json', base64: json }
    ])).resolves.toEqual({
      inlineJson: { ok: true, source: 'base64' }
    });
    expect(inline.fetcher).not.toHaveBeenCalled();
  });
});

function createScaleModeGame(scaleMode, parentWidth, parentHeight) {
  const parent = document.createElement('section');
  Object.defineProperties(parent, {
    clientWidth: { configurable: true, value: parentWidth },
    clientHeight: { configurable: true, value: parentHeight }
  });
  document.body.appendChild(parent);
  const canvas = document.createElement('canvas');
  const game = new Game({
    width: 1920,
    height: 1080,
    canvas,
    parent,
    scaleMode,
    autoAttach: true,
    autoResize: false,
    autoStart: false,
    renderer: 'canvas'
  });
  game.core.init();
  return { game, canvas, parent };
}
