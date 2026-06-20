import { describe, expect, it, vi } from 'vitest';
import OmniCore, {
  Game,
  Scene,
  SceneManager
} from '../src/index.js';

describe('developer-friendly quick checklist APIs', () => {
  it('draws debug text and collider rectangles directly through OmniCore.Debug', () => {
    const debug = OmniCore.Debug.configure({ debug: true, mode: 'development' });
    const text = debug.drawTextAt(12, 24, 'player: 12,24');
    const colliders = debug.drawColliderRects([
      { x: 4, y: 8, width: 16, height: 20, active: true },
      { x: 40, y: 8, width: 10, height: 10, active: false }
    ]);

    expect(text).toMatchObject({ type: 'text', x: 12, y: 24, text: 'player: 12,24' });
    expect(colliders).toHaveLength(2);
    expect(debug.renderer.commands.map((command) => command.type)).toEqual(['text', 'aabb', 'aabb']);
  });

  it('pushes UI overlays without blocking the underlying scene update', async () => {
    const updates = [];
    const game = {
      loop: { subscribe: () => () => {}, subscribeRender: () => () => {} },
      renderer: { renderScene: vi.fn() },
      events: { emit: vi.fn() }
    };
    const manager = new SceneManager(game);
    manager.register('map', new Scene('map'));
    manager.register('bag-ui', new Scene('bag-ui'));
    manager.registry.get('map').update = () => updates.push('map');
    manager.registry.get('bag-ui').update = () => updates.push('bag-ui');

    await manager.push('map');
    const overlay = await manager.pushOverlay('bag-ui', { id: 'bag' });
    manager.update(1 / 60, 16);

    expect(overlay.overlay).toBe(true);
    expect(overlay.uiOnly).toBe(true);
    expect(updates).toEqual(['map', 'bag-ui']);
  });

  it('saves and loads game snapshots through high-level Game helpers', async () => {
    localStorage.clear();
    const game = await new Game({
      headless: true,
      autoStart: false,
      adaptiveQuality: false,
      state: { corridor: 'north', fragments: 2 }
    }).init();

    game.store.set('corridor', 'east');
    game.store.set('fragments', 7);
    expect(game.saveSnapshot('slot1')).toMatchObject({ corridor: 'east', fragments: 7 });
    game.store.set('corridor', 'north');
    game.store.set('fragments', 2);

    expect(game.loadSnapshot('slot1')).toMatchObject({ corridor: 'east', fragments: 7 });
    expect(game.store.get('corridor')).toBe('east');
    expect(game.store.get('fragments')).toBe(7);
    game.destroy();
  });

  it('runs headless and exposes common math helpers', async () => {
    const game = await new Game({ headless: true, autoStart: false, adaptiveQuality: false }).init();

    expect(game.headless).toBe(true);
    expect(game.renderer).toBeNull();
    expect(OmniCore.Math.distance(0, 0, 3, 4)).toBe(5);
    expect(OmniCore.Math.angle(0, 0, 0, 1)).toBeCloseTo(Math.PI / 2);
    expect(OmniCore.Math.random()).toBeGreaterThanOrEqual(0);
    expect(OmniCore.Math.random()).toBeLessThan(1);
    game.destroy();
  });
});
