import { afterEach, describe, expect, it, vi } from 'vitest';
import OmniCore, { Game, InputManager, Loader } from '../src/index.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('offline and Chinese runtime hardening', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    OmniCore.Font.clear();
    document.body.innerHTML = '';
    delete globalThis.FontFace;
  });

  it('waits for FontFace.load and document.fonts.ready before reporting Chinese fonts ready', async () => {
    const fontLoad = deferred();
    const fontsReady = deferred();
    const addedFaces = [];
    let resolved = false;

    class FakeFontFace {
      constructor(family, source, descriptors) {
        this.family = family;
        this.source = source;
        this.descriptors = descriptors;
      }

      load() {
        return fontLoad.promise.then(() => this);
      }
    }

    globalThis.FontFace = FakeFontFace;
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        add: (face) => addedFaces.push(face),
        ready: fontsReady.promise
      }
    });

    const pending = OmniCore.Font.load('Noto Sans SC', '/fonts/NotoSansSC.woff2', { weight: '400' });
    pending.then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);
    fontLoad.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(resolved).toBe(false);

    fontsReady.resolve();
    const face = await pending;

    expect(face.family).toBe('Noto Sans SC');
    expect(face.source).toBe('url("/fonts/NotoSansSC.woff2")');
    expect(addedFaces).toHaveLength(1);
    expect(OmniCore.Font.isLoaded('Noto Sans SC')).toBe(true);
  });

  it('returns a typed local fallback instead of white-screening when file:// fetch is blocked', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fileFallbacks = [];
    const loader = new Loader({
      preferWebp: false,
      fetcher: vi.fn(async () => {
        throw new TypeError('Failed to fetch local file');
      })
    });
    loader.on('fileFallback', (payload) => fileFallbacks.push(payload));

    const bundle = await loader.loadBundle([
      { key: 'story', url: 'file:///game/assets/story.txt', type: 'text' }
    ]);

    expect(bundle.story).toBe('');
    expect(fileFallbacks).toHaveLength(1);
    expect(fileFallbacks[0]).toMatchObject({
      key: 'story',
      url: 'file:///game/assets/story.txt',
      protocol: 'file:'
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('suspends global game keyboard state while an HTML input or textarea owns focus', () => {
    const canvas = document.createElement('canvas');
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    document.body.append(canvas, input, textarea);
    const manager = new InputManager({ target: canvas });

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'w',
      code: 'KeyW',
      bubbles: true,
      cancelable: true
    }));
    expect(manager.keyboard.isDown('W')).toBe(true);

    input.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'a',
      code: 'KeyA',
      bubbles: true,
      cancelable: true
    }));
    expect(manager.keyboard.isDown('W')).toBe(false);
    expect(manager.keyboard.isDown('A')).toBe(false);

    textarea.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 's',
      code: 'KeyS',
      bubbles: true,
      cancelable: true
    }));
    expect(manager.keyboard.isDown('S')).toBe(false);

    textarea.blur();
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'd',
      code: 'KeyD',
      bubbles: true,
      cancelable: true
    }));
    expect(manager.keyboard.isDown('D')).toBe(true);

    manager.destroy();
  });

  it('propagates Game renderer.roundPixels into PixiRenderer sprite sync', async () => {
    const game = new Game({
      headless: true,
      autoStart: false,
      renderer: {
        backend: 'canvas',
        roundPixels: true
      }
    });

    expect(game.config.renderer).toBe('canvas');
    expect(game.config.roundPixels).toBe(true);

    const renderer = await game.createRenderer('canvas');
    const displayObject = {
      x: 0,
      y: 0,
      alpha: 1,
      rotation: 0,
      roundPixels: false,
      scale: {
        x: 1,
        y: 1,
        set(x, y) {
          this.x = x;
          this.y = y;
        }
      }
    };

    renderer._syncPixiSprite(displayObject, {
      type: 'sprite',
      x: 12.5,
      y: 18.25,
      alpha: 1,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      texture: null
    });

    expect(renderer.roundPixels).toBe(true);
    expect(displayObject.roundPixels).toBe(true);
  });
});
