import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { applyLiveSyncMessage, createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';
import { createAssetWatchServer } from '../scripts/asset-watch-server.js';
import { AssetRegistry, AssetRegistryChangeSet } from '../src/index.js';

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

  it('drives the resource panel from AssetRegistry change plans and hot reload events', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        scene: {
          name: 'main',
          entities: [
            { id: 'hero', name: 'Hero', sprite: 'assets/hero.png', prefabId: 'hero-prefab' }
          ]
        },
        assets: [
          { path: 'assets/hero.png', type: 'image', uid: 'uid://hero-texture' },
          { path: 'prefabs/hero.json', type: 'prefab', uid: 'uid://hero-prefab' },
          { path: 'scenes/main.json', type: 'scene', uid: 'uid://main-scene' }
        ],
        prefabs: [
          { id: 'hero-prefab', path: 'prefabs/hero.json', sprite: 'assets/hero.png' }
        ],
        projectFiles: {
          'scenes/main.json': '{"prefab":"prefabs/hero.json","texture":"assets/hero.png"}',
          'prefabs/hero.json': '{"sprite":"assets/hero.png"}'
        },
        dockLayout: {
          left: ['assets'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['runtime-debug']
        }
      })
    });

    const snapshot = app.EditorAPI.refreshAssetRegistryPanel({ query: 'hero' });
    expect(snapshot.audit.summary.ready).toBe(true);
    expect(snapshot.snapshot.referencers['assets/hero.png'].map((edge) => edge.asset)).toEqual(expect.arrayContaining([
      'prefabs/hero.json',
      'scenes/main.json'
    ]));
    expect(root.querySelector('[data-asset-registry-panel]')?.textContent).toContain('AssetRegistry');
    expect(root.querySelector('[data-asset-registry-row="assets/hero.png"]')?.textContent).toContain('引用 2');

    const refresh = app.EditorAPI.applyAssetRegistryChanges([
      { kind: 'modified', reference: 'assets/hero.png' },
      {
        kind: 'imported',
        asset: { path: 'assets/enemy.png', type: 'image', uid: 'uid://enemy-texture', labels: ['enemy'] }
      }
    ], { source: 'editor-file-watch', now: 20000 });

    expect(refresh.plan.summary).toMatchObject({
      source: 'editor-file-watch',
      changeCount: 2,
      affectedAssetCount: 2
    });
    expect(refresh.plan.runtimeActions).toEqual(expect.arrayContaining([
      { type: 'reloadAsset', asset: 'assets/hero.png', reason: 'modified' },
      { type: 'preloadAsset', asset: 'assets/enemy.png', reason: 'imported' },
      { type: 'refreshAsset', asset: 'prefabs/hero.json', reason: 'depends-on:assets/hero.png' },
      { type: 'refreshAsset', asset: 'scenes/main.json', reason: 'depends-on:assets/hero.png' }
    ]));
    expect(app.getState().assets.map((asset) => asset.path)).toContain('assets/enemy.png');

    const stream = app.EditorAPI.exportHotReloadEventStream({ since: 0 });
    expect(stream.events.map((event) => event.type)).toEqual(expect.arrayContaining([
      'asset:changed',
      'asset:imported',
      'assets:hot-update'
    ]));
    expect(stream.events.find((event) => event.type === 'assets:hot-update')).toMatchObject({
      incremental: true,
      files: expect.arrayContaining(['assets/enemy.png', 'assets/hero.png'])
    });
    expect(root.querySelector('[data-asset-registry-row="assets/enemy.png"]')?.textContent).toContain('新增');
    expect(root.querySelector('[data-hot-reload-event="assets:hot-update"]')?.textContent).toContain('assets/hero.png');
    expect(root.querySelector('[data-asset-refresh-plan]')?.textContent).toContain('prefabs/hero.json');
    app.destroy();
  });

  it('streams watch server change sessions into the editor resource panel', async () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        scene: {
          name: 'main',
          entities: [
            { id: 'hero', name: 'Hero', sprite: 'assets/hero.png', prefabId: 'hero-prefab' }
          ]
        },
        assets: [
          { path: 'assets/hero.png', type: 'image', uid: 'uid://hero-texture' },
          { path: 'prefabs/hero.json', type: 'prefab', uid: 'uid://hero-prefab' },
          { path: 'scenes/main.json', type: 'scene', uid: 'uid://main-scene' }
        ],
        prefabs: [
          { id: 'hero-prefab', path: 'prefabs/hero.json', sprite: 'assets/hero.png' }
        ],
        projectFiles: {
          'scenes/main.json': '{"prefab":"prefabs/hero.json","texture":"assets/hero.png"}',
          'prefabs/hero.json': '{"sprite":"assets/hero.png"}'
        },
        dockLayout: {
          left: ['assets'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['runtime-debug']
        }
      })
    });
    app.EditorAPI.refreshAssetRegistryPanel();

    const editorMessages = [];
    const server = createAssetWatchServer({
      source: 'assets',
      converter: async (files) => files.map((file) => ({ file, output: file.replace(/\.png$/u, '.webp') })),
      changePlanner: async () => createEditorWatchChangePlan(),
      editorSync: {
        send: (message) => editorMessages.push(JSON.parse(message))
      }
    });

    server.recordChange('assets/hero.png');
    server.recordChange('assets/enemy.png');
    const report = await server.flushPending();
    const nextState = applyLiveSyncMessage(app.getState(), editorMessages[0]);
    app.update(nextState);

    expect(report.editorRefresh).toMatchObject({
      schema: 'omnicore.editor-asset-watch-refresh.v1',
      assetRefresh: {
        source: 'editor-watch-server',
        plan: {
          summary: {
            affectedAssetCount: 2
          }
        }
      }
    });
    expect(editorMessages[0]).toMatchObject({
      type: 'editor:asset-watch-refresh',
      payload: {
        assetRefresh: {
          hmrPayload: {
            type: 'assets:hot-update',
            incremental: true,
            files: expect.arrayContaining(['assets/enemy.png', 'assets/hero.png'])
          }
        }
      }
    });
    expect(app.getState().assets.map((asset) => asset.path)).toContain('assets/enemy.png');
    expect(root.querySelector('[data-asset-registry-row="assets/hero.png"]')?.textContent).toContain('变更');
    expect(root.querySelector('[data-asset-registry-row="assets/enemy.png"]')?.textContent).toContain('新增');
    expect(root.querySelector('[data-hot-reload-event="assets:hot-update"]')?.textContent).toContain('assets/hero.png');
    expect(root.querySelector('[data-asset-refresh-plan]')?.textContent).toContain('prefabs/hero.json');
    server.close();
    app.destroy();
  });

  it('surfaces render frame budget diagnostics as an actionable editor panel', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        dockLayout: {
          left: ['assets'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['profiler']
        }
      })
    });

    const panel = app.EditorAPI.refreshRenderDiagnosticsPanel({
      budgets: {
        frameBudgetMs: 16.67,
        drawCallBudget: 4,
        textureUploadBudget: 2,
        filterPassBudget: 3
      },
      frame: { index: 7, cpuMs: 19, gpuMs: 12, fps: 50 },
      backend: {
        selected: 'webgl2',
        fallbackChain: ['webgpu', 'webgl2'],
        rejected: [{ id: 'webgpu', reason: 'adapter-missing' }]
      },
      draws: [
        { id: 'hero', texture: 'hero.png', material: 'lit', blendMode: 'normal' },
        { id: 'enemy', texture: 'enemy.png', material: 'lit', blendMode: 'normal' },
        { id: 'coin', texture: 'coin.png', material: 'lit', blendMode: 'normal' },
        { id: 'spark', texture: 'fx.png', material: 'additive', blendMode: 'add' },
        { id: 'ui', texture: 'ui.png', material: 'ui', blendMode: 'normal', dynamic: true }
      ],
      textureUploads: [
        { id: 'hero', bytes: 1024 },
        { id: 'enemy', bytes: 2048 },
        { id: 'ui', bytes: 4096 }
      ],
      filterPasses: [
        { id: 'bloom', passes: 2, estimatedMs: 1.4 },
        { id: 'blur', passes: 2, estimatedMs: 2.1 }
      ]
    });

    expect(panel.schema).toBe('omnicore.editor-render-diagnostics-panel.v1');
    expect(panel.report.schema).toBe('omnicore.render-frame-budget-report.v1');
    expect(panel.summary).toMatchObject({
      frameIndex: 7,
      severity: 'warning',
      cpuMs: 19,
      textureUploadCount: 3,
      filterPassCount: 4,
      backend: 'webgl2'
    });
    expect(panel.quickFixes.map((action) => action.id)).toEqual(expect.arrayContaining([
      'createAtlas:lit|normal',
      'deferTextureUploads',
      'flattenFilterChain',
      'preferWebGPUWhenAvailable'
    ]));
    expect(app.getState().renderDiagnosticsPanel.summary.frameIndex).toBe(7);
    expect(app.getDockLayout().bottom).toContain('render-diagnostics');
    expect(root.querySelector('[data-render-diagnostics-panel]')?.textContent).toContain('渲染诊断');
    expect(root.querySelector('[data-render-diagnostics-panel]')?.textContent).toContain('CPU 19ms');
    expect(root.querySelector('[data-render-diagnostics-panel]')?.textContent).toContain('纹理上传 3');
    expect(root.querySelector('[data-render-diagnostics-panel]')?.textContent).toContain('WebGPU');
    expect(root.querySelector('[data-render-diagnostics-issue="texture-upload-spike"]')).toBeTruthy();
    expect(root.querySelector('[data-render-diagnostics-action="deferTextureUploads"]')?.textContent).toContain('延后纹理上传');
    app.destroy();
  });

  it('applies render diagnostics quick fixes into concrete optimization plans', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        dockLayout: {
          left: ['assets'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['profiler']
        }
      })
    });

    app.EditorAPI.refreshRenderDiagnosticsPanel({
      budgets: {
        frameBudgetMs: 16.67,
        drawCallBudget: 4,
        textureUploadBudget: 2,
        filterPassBudget: 3
      },
      frame: { index: 9, cpuMs: 22, gpuMs: 18, fps: 45 },
      backend: {
        selected: 'webgl2',
        fallbackChain: ['webgpu', 'webgl2'],
        rejected: [{ id: 'webgpu', reason: 'adapter-missing' }]
      },
      draws: [
        { id: 'hero', texture: 'hero.png', material: 'lit', blendMode: 'normal' },
        { id: 'enemy', texture: 'enemy.png', material: 'lit', blendMode: 'normal' },
        { id: 'coin', texture: 'coin.png', material: 'lit', blendMode: 'normal' },
        { id: 'spark', texture: 'fx.png', material: 'additive', blendMode: 'add' }
      ],
      textureUploads: [
        { id: 'hero', bytes: 1024 },
        { id: 'enemy', bytes: 2048 },
        { id: 'ui', bytes: 4096 }
      ],
      filterPasses: [
        { id: 'bloom', passes: 2, estimatedMs: 1.4 },
        { id: 'blur', passes: 2, estimatedMs: 2.1 }
      ]
    });

    const textureResult = app.EditorAPI.applyRenderDiagnosticsQuickFix('deferTextureUploads', {
      now: Date.UTC(2026, 0, 1)
    });

    expect(textureResult.action).toMatchObject({
      id: 'deferTextureUploads',
      type: 'scheduleTextureUploads'
    });
    expect(textureResult.plan.schema).toBe('omnicore.editor-render-optimization-plan.v1');
    expect(textureResult.plan.textureUploads.deferred.map((upload) => upload.id)).toEqual(['hero', 'enemy', 'ui']);
    expect(app.getState().renderOptimizationPlan.textureUploads.deferred.map((upload) => upload.id)).toEqual(['hero', 'enemy', 'ui']);
    expect(app.getState().renderDiagnosticsPanel.appliedActions.map((action) => action.id)).toContain('deferTextureUploads');
    expect(root.querySelector('[data-render-optimization-plan]')?.textContent).toContain('纹理上传 3');
    expect(root.querySelector('[data-render-diagnostics-action="deferTextureUploads"]')?.textContent).toContain('已应用');

    root.querySelector('[data-render-diagnostics-action="createAtlas:lit|normal"]')?.click();
    const state = app.getState();
    expect(state.renderOptimizationPlan.atlases[0]).toMatchObject({
      key: 'lit|normal',
      textures: ['coin.png', 'enemy.png', 'hero.png'],
      status: 'planned'
    });
    expect(root.querySelector('[data-render-optimization-plan]')?.textContent).toContain('图集 1');
    expect(root.querySelector('[data-render-diagnostics-action="createAtlas:lit|normal"]')?.textContent).toContain('已应用');
    app.destroy();
  });

  it('surfaces missing dependency repair actions in the editor resource panel', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        scene: {
          name: 'main',
          entities: [
            { id: 'hero', name: 'Hero', sprite: 'assets/hero.png', prefabId: 'hero-prefab' }
          ]
        },
        assets: [
          { path: 'assets/hero.png', type: 'image', uid: 'uid://hero-texture' },
          { path: 'prefabs/hero.json', type: 'prefab', uid: 'uid://hero-prefab', dependencies: ['assets/hero.png'] },
          { path: 'scenes/main.json', type: 'scene', uid: 'uid://main-scene', dependencies: ['prefabs/hero.json'] }
        ],
        prefabs: [
          { id: 'hero-prefab', path: 'prefabs/hero.json', sprite: 'assets/hero.png' }
        ],
        projectFiles: {
          'scenes/main.json': '{"prefab":"prefabs/hero.json","texture":"assets/hero.png"}',
          'prefabs/hero.json': '{"sprite":"assets/hero.png"}'
        },
        dockLayout: {
          left: ['assets'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['runtime-debug']
        }
      })
    });

    const result = app.EditorAPI.applyAssetRegistryChanges([
      { kind: 'deleted', reference: 'assets/hero.png' }
    ], { source: 'editor-watch-server' });

    expect(result.plan.summary.brokenReferenceCount).toBe(2);
    expect(result.panel.diagnostics).toMatchObject({
      missingReferenceCount: 2,
      quickFixCount: 1
    });
    expect(root.querySelector('[data-asset-registry-diagnostics]')?.textContent).toContain('断引用 2');
    expect(root.querySelector('[data-asset-repair-action="register-missing:assets/hero.png"]')?.textContent).toContain('注册缺失资源');

    root.querySelector('[data-asset-repair-action="register-missing:assets/hero.png"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(app.getState().assets.find((asset) => asset.path === 'assets/hero.png')).toMatchObject({
      missingStub: true,
      changeKind: 'repaired'
    });
    expect(root.querySelector('[data-asset-registry-row="assets/hero.png"]')?.textContent).toContain('已修复');
    app.destroy();
  });
});

function createEditorWatchChangePlan() {
  const registry = new AssetRegistry({
    assets: [
      {
        uid: 'uid://main-scene',
        path: 'scenes/main.json',
        type: 'scene',
        dependencies: ['prefabs/hero.json', 'assets/hero.png']
      },
      {
        uid: 'uid://hero-prefab',
        path: 'prefabs/hero.json',
        type: 'prefab',
        dependencies: ['assets/hero.png']
      },
      {
        uid: 'uid://hero-texture',
        path: 'assets/hero.png',
        type: 'image'
      }
    ]
  });
  const session = new AssetRegistryChangeSet({ registry, source: 'editor-watch-server' });
  session.record({ kind: 'modified', reference: 'assets/hero.png' });
  session.record({
    kind: 'imported',
    asset: { path: 'assets/enemy.png', type: 'image', uid: 'uid://enemy-texture', labels: ['enemy'] }
  });
  return session.plan();
}
