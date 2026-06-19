import { describe, expect, it, vi, afterEach } from 'vitest';
import { EditorOverlay } from '../src/index.js';

describe('EditorOverlay runtime interaction', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('selects, edits, drags, and drops prefabs into the active scene', () => {
    const storeData = new Map();
    const scene = {
      name: 'overlay-scene',
      children: [{ id: 'hero', name: 'Hero', type: 'sprite', x: 10, y: 20, width: 32, height: 32 }],
      add(entity) {
        this.children.push(entity);
        return entity;
      }
    };
    const game = {
      scene: { current: scene },
      renderer: { renderScene: vi.fn() },
      store: {
        set(key, value) {
          storeData.set(key, value);
        },
        get(key) {
          return storeData.get(key);
        }
      }
    };
    const overlay = new EditorOverlay(game, {
      prefabs: [{ id: 'crate', name: 'Crate', texture: 'crate.png', width: 24, height: 24 }]
    }).attach(document.body);

    document.querySelector('[data-editor-overlay-entity-id="hero"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const xInput = document.querySelector('[data-editor-overlay-field="x"]');
    xInput.value = '64';
    xInput.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-editor-overlay-entity-id="hero"]').dispatchEvent(new MouseEvent('mousedown', {
      clientX: 64,
      clientY: 20,
      bubbles: true
    }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 90, clientY: 50, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperties(drop, {
      clientX: { value: 120 },
      clientY: { value: 80 },
      dataTransfer: {
        value: {
          getData: () => JSON.stringify({ id: 'crate', name: 'Crate', texture: 'crate.png', width: 24, height: 24 })
        }
      }
    });
    document.querySelector('[data-omnicore-editor-overlay]').dispatchEvent(drop);

    expect(scene.children).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'hero', x: 90, y: 50 }),
      expect.objectContaining({ prefabId: 'crate', x: 120, y: 80 })
    ]));
    expect(storeData.get('editor:overlay:moved')).toMatchObject({ package: 'omnicore-editor' });
    expect(overlay.exportSceneJson().entities).toHaveLength(2);
    expect(game.renderer.renderScene).toHaveBeenCalledWith(scene);
  });
});
