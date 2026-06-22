import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

let createEditorApp;
let createEditorState;

beforeAll(async () => {
  ({ createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href));
  ({ createEditorState } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/live-sync-protocol.js')).href));
});

afterEach(() => {
  document.body.innerHTML = '';
  delete window.omnicoreEditor;
  delete window.confirm;
});

describe('editor deep toolchain', () => {
  it('searches and replaces project files from Ctrl+Shift+F', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        projectFiles: {
          'src/npc.js': 'const name = "Slime";',
          'scenes/level.json': '{"enemy":"Slime"}'
        },
        dockLayout: { left: ['hierarchy'], center: ['scene-view'], right: ['inspector'], bottom: ['global-search'] }
      })
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', ctrlKey: true, shiftKey: true }));
    const results = app.EditorAPI.searchProject('Slime');

    expect(root.querySelector('[data-panel="global-search"]')?.textContent).toContain('全局搜索');
    expect(results).toHaveLength(2);
    expect(app.EditorAPI.replaceProject('Slime', 'Blob').changedFiles).toEqual(['src/npc.js', 'scenes/level.json']);
    expect(app.getState().projectFiles['src/npc.js']).toContain('Blob');
    app.destroy();
  });

  it('opens a thumbnail resource picker from sprite fields and deep links selected assets', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        scene: { entities: [{ id: 'hero', name: 'Hero', sprite: 'old.png', x: 0, y: 0 }] },
        selectedEntityId: 'hero',
        assets: [
          { path: 'assets/hero.png', type: 'image', thumbnail: 'thumb-hero.png' },
          { path: 'assets/slime.png', type: 'image', thumbnail: 'thumb-slime.png' }
        ]
      })
    });

    app.EditorAPI.openResourcePicker('sprite', { query: 'slime' });
    expect(root.querySelector('[data-resource-picker]')?.textContent).toContain('assets/slime.png');
    app.EditorAPI.selectResourceForField('sprite', 'assets/slime.png');

    expect(app.getState().scene.entities[0].sprite).toBe('assets/slime.png');
    app.destroy();
  });

  it('renders Physics View wireframes and prompts to save paused prefab hot edits', () => {
    const root = document.createElement('main');
    window.confirm = vi.fn(() => true);
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        playState: { mode: 'paused' },
        scene: {
          entities: [{
            id: 'slime',
            prefabId: 'slime-variant',
            physics: { shape: 'polygon', vertices: [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 8, y: 16 }] }
          }]
        },
        prefabs: [{ id: 'slime-variant', extends: 'slime-base', overrides: { hp: 10 } }],
        dockLayout: { left: ['hierarchy'], center: ['physics-view'], right: ['prefabs'], bottom: ['build-settings'] }
      })
    });

    app.EditorAPI.openPhysicsView();
    expect(root.querySelector('[data-panel="physics-view"]')?.textContent).toContain('Matter');
    expect(root.querySelector('[data-physics-wireframe="slime"]')).not.toBeNull();
    app.EditorAPI.editPrefabVariantRuntime('slime-variant', { hp: 20 });
    app.EditorAPI.exitPrefabHotEdit();

    expect(root.querySelector('[data-prefab-save-prompt]')?.textContent).toContain('slime-variant');
    app.EditorAPI.savePrefabHotEdit();
    expect(app.getState().prefabs[0].overrides.hp).toBe(20);
    app.destroy();
  });

  it('configures multi-platform build settings with strategy defaults', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        dockLayout: { left: ['hierarchy'], center: ['scene-view'], right: ['build-settings'], bottom: ['tilemap'] }
      })
    });

    app.EditorAPI.setBuildTarget('steam', true);
    app.EditorAPI.setBuildTarget('itch', true);
    const config = app.EditorAPI.exportBuildSettings();

    expect(root.querySelector('[data-panel="build-settings"]')?.textContent).toContain('构建设置');
    expect(config.targets.steam).toMatchObject({ enabled: true, compression: 'store', iconSize: 256 });
    expect(config.targets.itch).toMatchObject({ enabled: true, compression: 'brotli', configStrategy: 'portable' });
    app.destroy();
  });

  it('closes the editor loop across dependencies, resources, hot reload, and runtime debug', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        scene: {
          name: 'main',
          entities: [
            {
              id: 'hero',
              name: 'Hero',
              type: 'sprite',
              sprite: 'assets/hero.webp',
              prefabId: 'hero-base',
              script: 'scripts/hero.js',
              material: { normalMap: 'assets/hero-normal.webp' }
            },
            {
              id: 'door',
              name: 'Door',
              type: 'sprite',
              sprite: 'assets/missing-door.webp',
              prefabId: 'door-base',
              scene: 'scenes/room.json'
            }
          ]
        },
        selectedEntityId: 'hero',
        assets: [
          { path: 'assets/hero.webp', type: 'image' },
          { path: 'assets/hero-normal.webp', type: 'image' },
          { path: 'scenes/room.json', type: 'scene' },
          { path: 'prefabs/hero.json', type: 'prefab' },
          { path: 'scripts/hero.js', type: 'script' }
        ],
        prefabs: [
          { id: 'hero-base', name: 'HeroBase', sprite: 'assets/hero.webp', script: 'scripts/hero.js' },
          { id: 'door-base', name: 'DoorBase', sprite: 'assets/missing-door.webp', overrides: { scene: 'scenes/room.json' } }
        ],
        projectFiles: {
          'scenes/main.json': '{"hero":"assets/hero.webp","door":"assets/missing-door.webp","prefab":"prefabs/hero.json"}',
          'prefabs/door.json': '{"sprite":"assets/missing-door.webp","scene":"scenes/room.json"}',
          'scripts/hero.js': 'export function update() {}'
        },
        dockLayout: {
          left: ['hierarchy', 'prefabs', 'assets'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['runtime-debug', 'profiler']
        },
        profilerFrame: {
          frame: 1,
          totalMs: 12,
          at: 10000,
          sections: [{ name: 'scene.update', duration: 7 }]
        }
      })
    });

    const report = app.EditorAPI.createEditorClosureReport({ changedFiles: ['scenes/main.json'], now: 11000 });
    expect(report.missingAssets.map((asset) => asset.path)).toContain('assets/missing-door.webp');
    expect(report.sceneDependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'entity:door', field: 'sprite', path: 'assets/missing-door.webp' })
    ]));
    expect(report.prefabDependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({ prefabId: 'door-base', path: 'assets/missing-door.webp' })
    ]));
    expect(report.propertyPanel).toMatchObject({ entityId: 'hero', prefabId: 'hero-base' });
    expect(report.propertyPanel.fields.map((field) => field.key)).toEqual(expect.arrayContaining(['sprite', 'prefabId', 'script']));
    expect(report.resourceDatabase.find((asset) => asset.path === 'assets/missing-door.webp')).toMatchObject({
      missing: true,
      referenceCount: expect.any(Number)
    });

    const reload = app.EditorAPI.queueHotReload(['scenes/main.json', 'prefabs/door.json']);
    expect(reload.hotReloadManifest.affectedAssets).toEqual(expect.arrayContaining([
      'assets/missing-door.webp',
      'prefabs/hero.json'
    ]));
    app.recordDebugEvent({ type: 'trace', name: 'spawnHero', entityId: 'hero', at: 10500 });

    expect(app.exportDebugTimeline({ now: 11000 }).events[0]).toMatchObject({ name: 'spawnHero', entityId: 'hero' });
    expect(root.querySelector('[data-panel="runtime-debug"]')?.textContent).toContain('运行时调试');
    expect(root.querySelector('[data-runtime-debug-event="spawnHero"]')).not.toBeNull();
    expect(root.querySelector('[data-runtime-debug-missing="assets/missing-door.webp"]')).not.toBeNull();
    expect(root.querySelector('[data-runtime-debug-property-panel]')?.textContent).toContain('hero-base');

    const fixes = app.EditorAPI.applyEditorClosureFixes({ registerMissing: true });
    expect(fixes.registeredAssets).toEqual(expect.arrayContaining(['assets/missing-door.webp']));
    expect(app.getState().assets.map((asset) => asset.path)).toContain('assets/missing-door.webp');
    expect(app.EditorAPI.createEditorClosureReport().missingAssets).toHaveLength(0);
    expect(root.querySelector('[data-runtime-debug-resource="assets/missing-door.webp"]')?.textContent).toContain('缺失占位');
    app.destroy();
  });
});
