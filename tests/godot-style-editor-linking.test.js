import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';
import { Entity, Store } from '../src/index.js';

describe('Godot-style entity API ergonomics', () => {
  it('creates entities with local signals and mutable position accessors that sync Store', () => {
    const store = new Store();
    const entity = Entity.create({ id: 'hero', name: 'Hero', x: 1, y: 2 }, {
      store,
      storeKey: 'editor:selectedEntity'
    });
    const calls = [];

    const off = entity.on('died', (payload) => calls.push(payload));
    entity.emit('died', { hp: 0 });
    off();
    entity.emit('died', { hp: -1 });
    entity.position.x = 10;
    entity.position.y = 20;

    expect(calls).toEqual([{ hp: 0 }]);
    expect(entity).toMatchObject({ x: 10, y: 20 });
    expect(store.get('editor:selectedEntity')).toMatchObject({
      id: 'hero',
      name: 'Hero',
      x: 10,
      y: 20
    });
  });
});

describe('Godot-style desktop editor linking', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.OmniCore;
  });

  it('binds hierarchy selection to a deep inspector, prefab variants, and EditorAPI commands', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);

    const app = createEditorApp(root, {
      state: createEditorState({
        scene: {
          name: 'godot-links',
          entities: [
            {
              id: 'hero',
              name: 'Hero',
              type: 'sprite',
              x: 0,
              y: 0,
              scale: 1,
              sprite: 'hero.png',
              components: ['Transform']
            },
            {
              id: 'enemy',
              name: 'Enemy',
              type: 'sprite',
              x: 5,
              y: 6,
              scale: 2,
              sprite: 'enemy.png',
              components: [{ type: 'Health', hp: 30 }, { name: 'EnemyAI' }]
            }
          ]
        },
        prefabs: [
          {
            id: 'enemy',
            name: 'Enemy',
            type: 'sprite',
            texture: 'enemy.png',
            hp: 100,
            components: [{ type: 'Health', options: { hp: 100 } }]
          }
        ]
      })
    });

    root.querySelector('[data-editor-entity-id="enemy"]').click();

    expect(app.EditorAPI.getSelectedEntity()).toMatchObject({ id: 'enemy', name: 'Enemy' });
    expect(app.EditorAPI.getSceneTree().map((entity) => entity.id)).toEqual(['hero', 'enemy']);
    expect(root.querySelector('[data-inspector-field="x"]').value).toBe('5');
    expect(root.querySelector('[data-inspector-field="scale"]').value).toBe('2');
    expect(root.querySelector('[data-inspector-field="sprite"]').value).toBe('enemy.png');
    expect(root.querySelector('[data-inspector-components]')?.textContent).toContain('Health');
    expect(root.querySelector('[data-inspector-components]')?.textContent).toContain('EnemyAI');

    app.EditorAPI.patchInspector({ x: 42, sprite: 'enemy-alt.png' });
    const edited = app.getState().scene.entities.find((entity) => entity.id === 'enemy');

    expect(edited).toMatchObject({ x: 42, sprite: 'enemy-alt.png', texture: 'enemy-alt.png' });

    const variant = app.EditorAPI.createPrefabVariant('enemy', { name: 'Enemy Variant', hp: 50 }, {
      id: 'enemy-hp50'
    });

    expect(variant).toMatchObject({
      id: 'enemy-hp50',
      name: 'Enemy Variant',
      extends: 'enemy',
      hp: 50
    });
    expect(app.getState().prefabs).toEqual(expect.arrayContaining([expect.objectContaining({
      id: 'enemy-hp50',
      extends: 'enemy',
      hp: 50
    })]));
    expect(window.OmniCore.EditorAPI).toBe(app.EditorAPI);

    app.destroy();
  });

  it('opens the selected entity script in an external editor at the requested lifecycle symbol', () => {
    const root = document.createElement('main');
    const transport = { send: vi.fn() };
    document.body.appendChild(root);

    const app = createEditorApp(root, {
      transport,
      state: createEditorState({
        scene: {
          name: 'script-links',
          entities: [
            {
              id: 'npc-guard',
              name: 'Guard',
              type: 'sprite',
              x: 12,
              y: 20,
              script: {
                path: 'src/game/npc/GuardController.js',
                entry: 'onCollision',
                line: 48,
                column: 5
              }
            }
          ]
        }
      })
    });

    root.querySelector('[data-editor-entity-id="npc-guard"]').click();
    root.querySelector('[data-inspector-open-script]').click();

    const message = JSON.parse(transport.send.mock.calls.at(-1)[0]);
    expect(message).toMatchObject({
      type: 'editor:open-code',
      payload: {
        entityId: 'npc-guard',
        entityName: 'Guard',
        path: 'src/game/npc/GuardController.js',
        symbol: 'onCollision',
        line: 48,
        column: 5,
        editor: 'vscode'
      }
    });

    expect(app.EditorAPI.openEntityScript('npc-guard', 'update')).toMatchObject({
      entityId: 'npc-guard',
      path: 'src/game/npc/GuardController.js',
      symbol: 'update'
    });

    app.destroy();
  });
});
