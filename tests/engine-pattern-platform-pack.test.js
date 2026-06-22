import { describe, expect, it } from 'vitest';
import {
  ComposerSceneFlow,
  FantasyConsoleBank,
  InputDeviceMap,
  PersistentSaveSlot,
  RuntimeConfigFlags,
  SystemMenuModel
} from '../src/index.js';

describe('engine pattern platform pack', () => {
  it('models Playdate-style system menu items with limits and updates', () => {
    const calls = [];
    const menu = new SystemMenuModel({ maxItems: 3 });
    menu.addAction('restart', { label: 'Restart', onSelect: () => calls.push('restart') });
    menu.addCheckmark('music', { label: 'Music', value: true });
    menu.addOptions('difficulty', { label: 'Difficulty', options: ['easy', 'hard'], value: 'easy' });

    expect(menu.validate().ok).toBe(true);
    menu.select('restart');
    menu.toggle('music');
    menu.choose('difficulty', 'hard');

    expect(calls).toEqual(['restart']);
    expect(menu.snapshot().items).toEqual([
      { id: 'restart', label: 'Restart', type: 'action' },
      { id: 'music', label: 'Music', type: 'checkmark', value: false },
      { id: 'difficulty', label: 'Difficulty', type: 'options', options: ['easy', 'hard'], value: 'hard' }
    ]);

    const overflowing = new SystemMenuModel({ maxItems: 1 });
    overflowing.addAction('one');
    overflowing.addAction('two');
    expect(overflowing.validate().warnings[0].code).toBe('system-menu-limit-exceeded');
  });

  it('runs Solar2D-style composer scene lifecycle and overlays', () => {
    const calls = [];
    const flow = new ComposerSceneFlow();
    flow.register('menu', {
      create: ({ params }) => calls.push(`create:menu:${params.from || 'none'}`),
      show: ({ phase }) => calls.push(`show:menu:${phase}`),
      hide: ({ phase }) => calls.push(`hide:menu:${phase}`),
      destroy: () => calls.push('destroy:menu')
    });
    flow.register('pause', {
      create: () => calls.push('create:pause'),
      show: ({ overlay }) => calls.push(`show:pause:${overlay}`)
    });

    flow.gotoScene('menu', { params: { from: 'boot' }, effect: 'fade', time: 200 });
    flow.showOverlay('pause');
    flow.hideOverlay();
    flow.removeScene('menu');

    expect(flow.current().name).toBe('menu');
    expect(flow.history()).toEqual([{ name: 'menu', effect: 'fade', time: 200 }]);
    expect(calls).toEqual([
      'create:menu:boot',
      'show:menu:will',
      'show:menu:did',
      'create:pause',
      'show:pause:true',
      'destroy:menu'
    ]);
  });

  it('persists HaxeFlixel-style save slots with dirty tracking', () => {
    const backing = {};
    const save = new PersistentSaveSlot({
      adapter: {
        read: (key) => backing[key] || null,
        write: (key, value) => {
          backing[key] = value;
        },
        remove: (key) => {
          delete backing[key];
        }
      }
    });

    save.bind('player');
    save.set('highScore', 9000);
    save.set('settings.music', false);
    expect(save.dirty).toBe(true);
    save.flush();

    const loaded = new PersistentSaveSlot({ adapter: save.adapter }).bind('player').load();
    expect(loaded.get('highScore')).toBe(9000);
    expect(loaded.get('settings.music')).toBe(false);
    loaded.reset();
    expect(backing['omnicore:save:player']).toBeUndefined();
  });

  it('resolves raylib-style runtime config flags and action input maps', () => {
    const flags = new RuntimeConfigFlags({
      defaults: ['windowResizable'],
      flags: {
        windowResizable: { module: 'core', feature: 'window.resizable' },
        vsync: { module: 'renderer', feature: 'renderer.vsync' }
      }
    });
    flags.set('vsync').clear('windowResizable');
    expect(flags.enabled()).toEqual(['vsync']);
    expect(flags.resolve()).toEqual({
      modules: { renderer: ['vsync'] },
      features: { 'renderer.vsync': true, 'window.resizable': false }
    });

    const input = new InputDeviceMap({
      actions: {
        jump: ['keyboard:Space', 'gamepad:0:A'],
        moveX: [{ type: 'axis', device: 'gamepad', index: 0, axis: 'leftX' }]
      }
    });
    expect(input.match({ device: 'keyboard', code: 'Space' })).toEqual(['jump']);
    expect(input.vector({ gamepad: { 0: { axes: { leftX: -0.75 } } } })).toEqual({ moveX: -0.75 });
  });

  it('packages fantasy-console palette, sprite, map, and sound banks', () => {
    const bank = new FantasyConsoleBank({
      palette: ['#000000', '#ffffff'],
      sprites: {
        hero: { pixels: [0, 1, 1, 0], width: 2, height: 2 }
      },
      map: [
        ['hero', 0],
        [0, 'hero']
      ],
      sounds: {
        coin: { notes: ['C4', 'E4'], tempo: 120 }
      }
    });

    expect(bank.sprite('hero').pixels).toEqual([0, 1, 1, 0]);
    expect(bank.tileAt(1, 1)).toBe('hero');
    expect(bank.exportCartridge({ name: 'mini' })).toEqual({
      name: 'mini',
      palette: ['#000000', '#ffffff'],
      sprites: ['hero'],
      sounds: ['coin'],
      mapSize: { width: 2, height: 2 }
    });
  });
});
