import { afterEach, describe, expect, it, vi } from 'vitest';
import OmniCore, { Store } from '../src/index.js';
import InputManager from '../src/input/InputManager.js';
import { StorageManager } from '../src/net/NetManager.js';

describe('migration painkiller runtime behavior', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    StorageManager.memory.clear();
    vi.restoreAllMocks();
  });

  it('lets HTML overlays consume pointer events above the canvas', () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    const overlay = document.createElement('button');
    overlay.style.pointerEvents = 'none';
    container.append(canvas, overlay);
    document.body.append(container);

    const input = new InputManager({ target: canvas });
    const parentPointer = vi.fn();
    const parentClick = vi.fn();
    container.addEventListener('pointerdown', parentPointer);
    container.addEventListener('click', parentClick);

    const cleanup = input.pointer.enableEventPropagation(overlay);
    overlay.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(overlay.style.pointerEvents).toBe('auto');
    expect(parentPointer).not.toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();

    cleanup();
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(overlay.style.pointerEvents).toBe('none');
    expect(parentClick).toHaveBeenCalledTimes(1);
    input.destroy();
  });

  it('ignores keyboard events that originate from HTML form controls', () => {
    const canvas = document.createElement('canvas');
    const inputBox = document.createElement('input');
    const textarea = document.createElement('textarea');
    document.body.append(canvas, inputBox, textarea);
    const input = new InputManager({ target: canvas });

    inputBox.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'a',
      code: 'KeyA',
      bubbles: true,
      cancelable: true
    }));
    textarea.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'b',
      code: 'KeyB',
      bubbles: true,
      cancelable: true
    }));
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'c',
      code: 'KeyC',
      bubbles: true,
      cancelable: true
    }));

    expect(input.keyboard.isDown('A')).toBe(false);
    expect(input.keyboard.isDown('B')).toBe(false);
    expect(input.keyboard.isDown('C')).toBe(true);
    input.destroy();
  });

  it('imports legacy localStorage saves into Store with path and transform mappings', () => {
    localStorage.setItem('phaser-save', JSON.stringify({
      profile: { name: 'Mira' },
      progress: { level: 7 },
      inventory: { coins: 245 },
      nodes: { '03': { unlocked: true } }
    }));
    const store = new Store();

    const report = StorageManager.importLegacy('phaser-save', {
      'player.name': 'profile.name',
      level: 'progress.level',
      gold: ({ legacy }) => legacy.inventory.coins,
      'flags.node03': {
        from: 'nodes.03.unlocked',
        transform: (value) => Boolean(value)
      }
    }, { store });

    expect(report).toMatchObject({
      imported: true,
      key: 'phaser-save',
      importedKeys: ['player.name', 'level', 'gold', 'flags.node03']
    });
    expect(store.get('player.name')).toBe('Mira');
    expect(store.get('level')).toBe(7);
    expect(store.get('gold')).toBe(245);
    expect(store.get('flags.node03')).toBe(true);
  });

  it('persists and restores debug checkpoint snapshots from Game.store', async () => {
    const game = await new OmniCore.Game({
      headless: true,
      debug: true,
      autoStart: false,
      adaptiveQuality: false,
      state: { node: 'start', hp: 100 }
    }).init();

    game.store.set('node', '03');
    game.store.set('hp', 42);
    const snapshot = game.store.snapshot('checkpoint-node-03');
    game.store.set('node', 'start');
    game.store.set('hp', 100);
    const loaded = game.store.loadSnapshot('checkpoint-node-03');

    expect(snapshot).toMatchObject({ node: '03', hp: 42 });
    expect(loaded).toMatchObject({ node: '03', hp: 42 });
    expect(game.store.get('node')).toBe('03');
    expect(game.store.get('hp')).toBe(42);
    game.destroy();
  });

  it('keeps named checkpoint persistence disabled outside debug mode', () => {
    const storage = {
      set: vi.fn(),
      get: vi.fn(() => null)
    };
    const store = new Store({ node: '01' }, {
      debug: false,
      checkpointStorage: storage
    });

    expect(store.snapshot('node-01')).toEqual({ node: '01' });
    expect(store.loadSnapshot('node-01')).toBeNull();
    expect(storage.set).not.toHaveBeenCalled();
  });
});
