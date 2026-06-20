import { describe, expect, it, vi } from 'vitest';
import OmniCore, {
  Camera,
  EventBus,
  Game,
  InputManager,
  Loader,
  Math as OmniMath,
  Scene,
  Sound,
  Text
} from '../src/index.js';

describe('OmniCore required eight-dimension foundation API surface', () => {
  it('supports camera fade, flash, and shake effects', () => {
    const camera = new Camera();

    expect(camera.fadeOut(250, '#000000')).toBe(camera);
    expect(camera.screenEffect).toMatchObject({ type: 'fadeOut', duration: 250, color: '#000000' });
    camera.update(0.125);
    expect(camera.screenEffect.alpha).toBeGreaterThan(0);

    camera.fadeIn(120, '#ffffff');
    expect(camera.screenEffect).toMatchObject({ type: 'fadeIn', duration: 120, color: '#ffffff' });

    camera.flash(80, '#ff0000');
    expect(camera.screenEffect).toMatchObject({ type: 'flash', duration: 80, color: '#ff0000' });

    camera.shake(60, 3);
    expect(camera.shakeRemaining).toBe(60);
  });

  it('pauses and resumes scenes and all sounds with master volume control', () => {
    const scene = new Scene('battle');
    const updateSpy = vi.fn();
    scene.add({ update: updateSpy, sprite: {}, x: 0, y: 0 });

    expect(scene.pause()).toBe(scene);
    scene.update(16, 16);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(scene.resume()).toBe(scene);
    scene.update(16, 32);
    expect(updateSpy).toHaveBeenCalledTimes(1);

    const sound = new Sound({ context: { suspend: vi.fn(), resume: vi.fn() } });
    const voice = { pause: vi.fn(), resume: vi.fn() };
    sound.active.add(voice);

    expect(sound.pauseAll()).toBe(sound);
    expect(voice.pause).toHaveBeenCalled();
    expect(sound.resumeAll()).toBe(sound);
    expect(voice.resume).toHaveBeenCalled();
    expect(sound.setVolume('master', 0.42)).toMatchObject({ name: 'master', volume: 0.42 });
  });

  it('supports disabling all input and querying keyboard justDown/justUp edges', () => {
    const input = new InputManager();

    input.keyboard.press('KeyW');
    expect(input.keyboard.justDown('W')).toBe(true);
    expect(input.keyboard.justDown('W')).toBe(false);
    input.keyboard.release('KeyW');
    expect(input.keyboard.justUp('W')).toBe(true);
    expect(input.keyboard.justUp('W')).toBe(false);

    expect(input.disableAll()).toBe(input);
    input.keyboard.press('KeyA');
    expect(input.keyboard.isDown('A')).toBe(false);
    expect(input.enableAll()).toBe(input);
    input.keyboard.press('KeyA');
    expect(input.keyboard.isDown('A')).toBe(true);
  });

  it('updates text styles and UI button labels dynamically', () => {
    const text = new Text('Score', { fill: '#ffffff', font: '12px sans-serif' });
    expect(text.setStyle({ fill: '#22d3ee', font: '20px serif', align: 'center' })).toBe(text);
    expect(text.style).toMatchObject({ fill: '#22d3ee', font: '20px serif', align: 'center' });

    const button = new OmniCore.UI.Button('Start');
    expect(button.setLabel('Resume')).toBe(button);
    expect(button.text).toBe('Resume');
  });

  it('shows and hides FPS and logs scene hierarchy', () => {
    const game = new Game({ headless: true, autoStart: false });
    const overlay = game.showFPS();

    expect(overlay.dataset.omnicoreFps).toBe('true');
    expect(game.hideFPS()).toBe(game);
    expect(document.querySelector('[data-omnicore-fps="true"]')).toBeNull();

    const scene = new Scene('hud');
    scene.add({ id: 'root', type: 'container', children: [{ id: 'label', type: 'text' }] });
    expect(scene.logHierarchy()).toContain('hud');
    expect(scene.logHierarchy()).toContain('label');
  });

  it('exposes randomBetween and lerp on OmniCore.Math', () => {
    const value = OmniMath.randomBetween(4, 8);
    expect(value).toBeGreaterThanOrEqual(4);
    expect(value).toBeLessThanOrEqual(8);
    expect(OmniMath.lerp(10, 20, 0.25)).toBe(12.5);
  });

  it('emits loader progress and complete events', async () => {
    const events = [];
    const loader = new Loader({
      fetcher: vi.fn(async () => ({
        ok: true,
        text: async () => 'ok'
      }))
    });

    loader.on('progress', (payload) => events.push(['progress', payload.loaded, payload.total]));
    loader.on('complete', (payload) => events.push(['complete', payload.total]));
    await loader.loadBundle([
      { key: 'a', url: '/a.txt', type: 'text' },
      { key: 'b', url: '/b.txt', type: 'text' }
    ]);

    expect(events).toEqual(expect.arrayContaining([
      ['progress', 1, 2],
      ['progress', 2, 2],
      ['complete', 2]
    ]));
  });

  it('supports EventBus.once handlers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once('ready', handler);

    bus.emit('ready', 1);
    bus.emit('ready', 2);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
  });
});
