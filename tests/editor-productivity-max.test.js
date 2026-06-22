import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let createEditorApp;
let createEditorState;

describe('editor productivity max workflow', () => {
  beforeAll(async () => {
    ({ createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href));
    ({ createEditorState } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/live-sync-protocol.js')).href));
  });

  function mountEditor() {
    document.body.innerHTML = '<main id="app"></main>';
    const root = document.querySelector('#app');
    const app = createEditorApp(root, {
      state: createEditorState({
        scene: {
          name: 'productivity',
          entities: [
            {
              id: 'hero',
              name: 'Hero',
              type: 'sprite',
              texture: 'hero.png',
              x: 10,
              y: 10,
              width: 32,
              height: 32,
              collider: { width: 28, height: 28 },
              zIndex: 2
            },
            {
              id: 'hero',
              name: 'Duplicate Hero',
              type: 'sprite',
              x: 96,
              y: 20,
              width: 32,
              height: 32
            }
          ]
        },
        selectedEntityId: 'hero',
        selectedEntityIds: ['hero'],
        dockLayout: {
          left: ['hierarchy'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['prefabs']
        }
      })
    });
    return { root, app };
  }

  it('snaps drag movement to grid and shows undo history entries', () => {
    const { root, app } = mountEditor();

    app.setGridSnap({ enabled: true, size: 16 });
    const heroNode = root.querySelector('[data-scene-node-id="hero"]');
    heroNode.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 37, clientY: 42, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const hero = app.getState().scene.entities.find((entity) => entity.name === 'Hero');
    expect(hero).toMatchObject({ x: 32, y: 48 });
    expect(root.querySelector('[data-undo-history]')?.textContent).toContain('拖动 1 个实体');

    app.destroy();
  });

  it('runs command palette validation and lets users locate scene issues', () => {
    const { root, app } = mountEditor();

    app.openCommandPalette();
    expect(root.querySelector('[data-command-palette]')).toBeTruthy();
    const validation = app.runCommand('scene:validate');

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate-entity-id', entityId: 'hero' }),
      expect.objectContaining({ code: 'missing-texture', entityId: 'hero' })
    ]));
    expect(root.querySelector('[data-scene-validation]')?.textContent).toContain('duplicate-entity-id');

    app.locateSceneIssue(validation.issues[0]);
    expect(app.getState().selectedEntityId).toBe('hero');
    expect(root.querySelector('[data-scene-node-id="hero"]')?.className).toContain('issue-target');

    app.destroy();
  });

  it('records prefab versions and reports scene diffs from a baseline', () => {
    const { app } = mountEditor();

    app.captureSceneBaseline('before-edit');
    const first = app.createPrefabSnapshot('hero', { note: 'initial' });
    app.EditorAPI.patchInspector({ x: 64, y: 80 });
    const second = app.createPrefabSnapshot('hero', { note: 'moved' });
    const diff = app.getSceneDiff('before-edit');

    expect(first).toMatchObject({ version: 1, entityId: 'hero' });
    expect(second).toMatchObject({ version: 2, entityId: 'hero' });
    expect(app.getPrefabHistory('hero')).toHaveLength(2);
    expect(diff.changed).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'hero', fields: expect.arrayContaining(['x', 'y']) })
    ]));

    app.destroy();
  });

  it('renders collision and depth overlays for 2.5D debugging', () => {
    const { root, app } = mountEditor();

    app.toggleSceneOverlays({ collision: true, depth: true });

    expect(root.querySelector('[data-collision-overlay="hero"]')).toBeTruthy();
    expect(root.querySelector('[data-depth-overlay="hero"]')?.textContent).toContain('z:2');

    app.destroy();
  });
});
