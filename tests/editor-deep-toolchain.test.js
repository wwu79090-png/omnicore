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

  it('exports render optimization plans into runtime sync and runnable project bundles', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        scene: { name: 'render-runtime', entities: [{ id: 'hero', sprite: 'hero.png' }] },
        dockLayout: {
          left: ['assets'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['render-diagnostics']
        }
      })
    });

    app.EditorAPI.refreshRenderDiagnosticsPanel({
      budgets: {
        textureUploadBudget: 2,
        filterPassBudget: 3
      },
      frame: { index: 12, cpuMs: 21, gpuMs: 17, fps: 42 },
      backend: {
        selected: 'webgl2',
        fallbackChain: ['webgpu', 'webgl2'],
        rejected: [{ id: 'webgpu', reason: 'adapter-missing' }]
      },
      draws: [
        { id: 'hero', texture: 'hero.png', material: 'lit', blendMode: 'normal' },
        { id: 'enemy', texture: 'enemy.png', material: 'lit', blendMode: 'normal' },
        { id: 'coin', texture: 'coin.png', material: 'lit', blendMode: 'normal' }
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
    app.EditorAPI.applyRenderDiagnosticsQuickFix('deferTextureUploads', { now: Date.UTC(2026, 0, 1) });
    app.EditorAPI.applyRenderDiagnosticsQuickFix('createAtlas:lit|normal', { now: Date.UTC(2026, 0, 1) + 1 });
    app.EditorAPI.applyRenderDiagnosticsQuickFix('flattenFilterChain', { now: Date.UTC(2026, 0, 1) + 2 });
    app.EditorAPI.applyRenderDiagnosticsQuickFix('preferWebGPUWhenAvailable', { now: Date.UTC(2026, 0, 1) + 3 });

    const runtimePlan = app.EditorAPI.exportRenderOptimizationPlan({
      generatedAt: '2026-01-01T00:00:00.000Z'
    });

    expect(runtimePlan.format).toBe('OmniCore.RenderOptimizationRuntimePlan');
    expect(runtimePlan.schema).toBe('omnicore.render-optimization-runtime.v1');
    expect(runtimePlan.runtimeActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'scheduleTextureUpload', id: 'hero', strategy: 'warmup-or-frame-split' }),
      expect.objectContaining({ type: 'buildAtlas', key: 'lit|normal', textures: ['coin.png', 'enemy.png', 'hero.png'] }),
      expect.objectContaining({ type: 'flattenFilter', id: 'bloom', targetPasses: 1 }),
      expect.objectContaining({ type: 'preferBackend', backend: 'webgpu' })
    ]));
    expect(runtimePlan.scheduler.textureUploads.maxUploadsPerFrame).toBe(2);

    const syncPayload = app.createRuntimeSyncPayload();
    expect(syncPayload.renderOptimizationRuntime.runtimeActions.map((action) => action.type)).toEqual(expect.arrayContaining([
      'buildAtlas',
      'scheduleTextureUpload',
      'flattenFilter',
      'preferBackend'
    ]));
    expect(app.applyRuntimeSyncPayload(syncPayload).renderOptimizationPlan.id).toBe(runtimePlan.sourcePlanId);
    const syncedState = applyLiveSyncMessage(createEditorState(), {
      type: 'editor:render-optimization-runtime-plan',
      payload: runtimePlan
    });
    expect(syncedState.renderOptimizationPlan.id).toBe(runtimePlan.sourcePlanId);

    const project = app.EditorAPI.exportRunnableProject({ generatedAt: '2026-01-01T00:00:00.000Z' });
    const renderConfig = project.files.find((file) => file.path === 'config/render-optimization.runtime.json');
    expect(renderConfig.data.runtimeActions.map((action) => action.type)).toContain('buildAtlas');
    expect(root.querySelector('[data-render-optimization-plan]')?.textContent).toContain('运行时动作 7');
    app.destroy();
  });

  it('verifies render optimization impact in the editor diagnostics panel', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const messages = [];
    const app = createEditorApp(root, {
      state: createEditorState({
        dockLayout: {
          left: ['assets'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['render-diagnostics']
        }
      }),
      transport: {
        send: (message) => messages.push(JSON.parse(message))
      }
    });

    app.EditorAPI.refreshRenderDiagnosticsPanel({
      budgets: {
        frameBudgetMs: 16.67,
        drawCallBudget: 4,
        textureUploadBudget: 2,
        filterPassBudget: 3
      },
      frame: { index: 15, cpuMs: 21, gpuMs: 18, fps: 43 },
      backend: { selected: 'webgl2', fallbackChain: ['webgpu', 'webgl2'] },
      draws: [
        { id: 'hero', texture: 'hero.png', material: 'lit', blendMode: 'normal' },
        { id: 'enemy', texture: 'enemy.png', material: 'lit', blendMode: 'normal' },
        { id: 'coin', texture: 'coin.png', material: 'lit', blendMode: 'normal' }
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
    app.EditorAPI.applyRenderDiagnosticsQuickFix('deferTextureUploads', { now: Date.UTC(2026, 0, 1) });
    app.EditorAPI.applyRenderDiagnosticsQuickFix('createAtlas:lit|normal', { now: Date.UTC(2026, 0, 1) + 1 });
    app.EditorAPI.applyRenderDiagnosticsQuickFix('flattenFilterChain', { now: Date.UTC(2026, 0, 1) + 2 });
    const runtimePlan = app.EditorAPI.exportRenderOptimizationPlan({
      generatedAt: '2026-01-01T00:00:00.000Z'
    });

    const verification = app.EditorAPI.verifyRenderOptimizationPlan({
      applyReport: {
        schema: 'omnicore.render-optimization-apply-report.v1',
        sourcePlanId: runtimePlan.sourcePlanId,
        status: 'applied',
        applied: runtimePlan.runtimeActions,
        summary: { appliedCount: runtimePlan.runtimeActions.length }
      },
      before: { frameMs: 21, drawCalls: 9, textureUploads: 3, filterPasses: 4 },
      after: { frameMs: 15.5, drawCalls: 4, textureUploads: 2, filterPasses: 2 },
      budgets: { frameMs: 16.67, drawCalls: 4, textureUploads: 2, filterPasses: 3 },
      now: Date.UTC(2026, 0, 1) + 10
    });

    expect(verification).toMatchObject({
      schema: 'omnicore.render-optimization-verification-report.v1',
      sourcePlanId: runtimePlan.sourcePlanId,
      status: 'passed',
      ok: true,
      summary: {
        gatesPassed: 4,
        gatesFailed: 0,
        savedDrawCalls: 5,
        frameMsDelta: -5.5
      }
    });
    expect(app.getState().renderOptimizationVerification.status).toBe('passed');
    expect(messages.map((message) => message.type)).toContain('editor:render-optimization-verification');
    expect(root.querySelector('[data-render-optimization-verification]')?.textContent).toContain('验证通过');
    expect(root.querySelector('[data-render-optimization-verification]')?.textContent).toContain('门禁 4/4');
    expect(root.querySelector('[data-render-optimization-verification]')?.textContent).toContain('Draw Call -5');
    const syncedState = applyLiveSyncMessage(createEditorState(), {
      type: 'editor:render-optimization-verification',
      payload: verification
    });
    expect(syncedState.renderOptimizationVerification.status).toBe('passed');
    app.destroy();
  });

  it('creates remediation plans when render optimization verification fails', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const messages = [];
    const app = createEditorApp(root, {
      state: createEditorState({
        dockLayout: {
          left: ['assets'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['render-diagnostics']
        }
      }),
      transport: {
        send: (message) => messages.push(JSON.parse(message))
      }
    });

    app.EditorAPI.refreshRenderDiagnosticsPanel({
      budgets: {
        frameBudgetMs: 16.67,
        drawCallBudget: 4,
        textureUploadBudget: 2,
        filterPassBudget: 3
      },
      frame: { index: 16, cpuMs: 19, gpuMs: 17, fps: 45 },
      draws: [
        { id: 'hero', texture: 'hero.png', material: 'lit', blendMode: 'normal' },
        { id: 'enemy', texture: 'enemy.png', material: 'lit', blendMode: 'normal' },
        { id: 'coin', texture: 'coin.png', material: 'lit', blendMode: 'normal' }
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
    app.EditorAPI.applyRenderDiagnosticsQuickFix('deferTextureUploads', { now: Date.UTC(2026, 0, 1) });
    app.EditorAPI.applyRenderDiagnosticsQuickFix('createAtlas:lit|normal', { now: Date.UTC(2026, 0, 1) + 1 });
    app.EditorAPI.applyRenderDiagnosticsQuickFix('flattenFilterChain', { now: Date.UTC(2026, 0, 1) + 2 });
    const runtimePlan = app.EditorAPI.exportRenderOptimizationPlan({
      generatedAt: '2026-01-01T00:00:00.000Z'
    });

    const verification = app.EditorAPI.verifyRenderOptimizationPlan({
      applyReport: {
        schema: 'omnicore.render-optimization-apply-report.v1',
        sourcePlanId: runtimePlan.sourcePlanId,
        status: 'applied',
        applied: runtimePlan.runtimeActions,
        summary: { appliedCount: runtimePlan.runtimeActions.length }
      },
      before: { frameMs: 15.5, drawCalls: 4, textureUploads: 2, filterPasses: 2 },
      after: { frameMs: 23, drawCalls: 9, textureUploads: 5, filterPasses: 5 },
      budgets: { frameMs: 16.67, drawCalls: 4, textureUploads: 2, filterPasses: 3 },
      now: Date.UTC(2026, 0, 1) + 20
    });

    expect(verification.status).toBe('failed');
    expect(verification.remediationPlan).toMatchObject({
      schema: 'omnicore.render-optimization-remediation-plan.v1',
      sourcePlanId: runtimePlan.sourcePlanId,
      priority: 'critical'
    });
    expect(verification.remediationPlan.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'rollbackRenderPlan', label: '回退优化计划' }),
      expect.objectContaining({ type: 'rebuildAtlasGroups', gate: 'draw-call-budget' }),
      expect.objectContaining({ type: 'capTextureUploads', gate: 'texture-upload-budget', maxUploadsPerFrame: 2 }),
      expect.objectContaining({ type: 'reduceFilterPasses', gate: 'filter-pass-budget', targetPasses: 3 }),
      expect.objectContaining({ type: 'captureRenderProfile', gate: 'frame-budget' })
    ]));
    expect(app.getState().renderOptimizationRemediationPlan.actions.map((action) => action.type)).toEqual(expect.arrayContaining([
      'rollbackRenderPlan',
      'rebuildAtlasGroups',
      'capTextureUploads',
      'reduceFilterPasses',
      'captureRenderProfile'
    ]));
    expect(messages.map((message) => message.type)).toEqual(expect.arrayContaining([
      'editor:render-optimization-verification',
      'editor:render-optimization-remediation-plan'
    ]));
    expect(root.querySelector('[data-render-optimization-verification]')?.textContent).toContain('验证失败');
    expect(root.querySelector('[data-render-optimization-remediation]')?.textContent).toContain('后续修复');
    expect(root.querySelector('[data-render-optimization-remediation]')?.textContent).toContain('回退优化计划');
    expect(root.querySelector('[data-render-optimization-remediation]')?.textContent).toContain('纹理上传降级');
    expect(app.createRuntimeSyncPayload().renderOptimizationRemediation.actions.map((action) => action.type)).toContain('rollbackRenderPlan');
    const syncedState = applyLiveSyncMessage(createEditorState(), {
      type: 'editor:render-optimization-remediation-plan',
      payload: verification.remediationPlan
    });
    expect(syncedState.renderOptimizationRemediationPlan.sourcePlanId).toBe(runtimePlan.sourcePlanId);
    app.destroy();
  });

  it('applies render optimization remediation actions back into runtime plans', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const messages = [];
    const app = createEditorApp(root, {
      state: createEditorState({
        dockLayout: {
          left: ['assets'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['render-diagnostics']
        }
      }),
      transport: {
        send: (message) => messages.push(JSON.parse(message))
      }
    });

    app.EditorAPI.refreshRenderDiagnosticsPanel({
      budgets: {
        frameBudgetMs: 16.67,
        drawCallBudget: 4,
        textureUploadBudget: 2,
        filterPassBudget: 3
      },
      frame: { index: 17, cpuMs: 19, gpuMs: 17, fps: 45 },
      draws: [
        { id: 'hero', texture: 'hero.png', material: 'lit', blendMode: 'normal' },
        { id: 'enemy', texture: 'enemy.png', material: 'lit', blendMode: 'normal' },
        { id: 'coin', texture: 'coin.png', material: 'lit', blendMode: 'normal' }
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
    app.EditorAPI.applyRenderDiagnosticsQuickFix('deferTextureUploads', { now: Date.UTC(2026, 0, 1) });
    app.EditorAPI.applyRenderDiagnosticsQuickFix('createAtlas:lit|normal', { now: Date.UTC(2026, 0, 1) + 1 });
    app.EditorAPI.applyRenderDiagnosticsQuickFix('flattenFilterChain', { now: Date.UTC(2026, 0, 1) + 2 });
    const runtimePlan = app.EditorAPI.exportRenderOptimizationPlan({
      generatedAt: '2026-01-01T00:00:00.000Z'
    });
    app.EditorAPI.verifyRenderOptimizationPlan({
      applyReport: {
        schema: 'omnicore.render-optimization-apply-report.v1',
        sourcePlanId: runtimePlan.sourcePlanId,
        status: 'applied',
        applied: runtimePlan.runtimeActions,
        summary: { appliedCount: runtimePlan.runtimeActions.length }
      },
      before: { frameMs: 15.5, drawCalls: 4, textureUploads: 2, filterPasses: 2 },
      after: { frameMs: 23, drawCalls: 9, textureUploads: 5, filterPasses: 5 },
      budgets: { frameMs: 16.67, drawCalls: 4, textureUploads: 2, filterPasses: 3 },
      now: Date.UTC(2026, 0, 1) + 20
    });

    const textureFix = app.EditorAPI.applyRenderOptimizationRemediation('cap-texture-uploads', {
      now: Date.UTC(2026, 0, 1) + 30
    });
    const filterFix = app.EditorAPI.applyRenderOptimizationRemediation('reduce-filter-passes', {
      now: Date.UTC(2026, 0, 1) + 31
    });
    const captureFix = app.EditorAPI.applyRenderOptimizationRemediation('capture-render-profile', {
      now: Date.UTC(2026, 0, 1) + 32
    });

    expect(textureFix).toMatchObject({
      action: { type: 'capTextureUploads', applied: true },
      result: { textureUploadBudget: 2 }
    });
    expect(filterFix).toMatchObject({
      action: { type: 'reduceFilterPasses', applied: true },
      result: { filterPassBudget: 3 }
    });
    expect(captureFix).toMatchObject({
      action: { type: 'captureRenderProfile', applied: true },
      result: { eventType: 'render-optimization-remediation-profile' }
    });
    const state = app.getState();
    expect(state.renderOptimizationPlan.budgets.textureUploadBudget).toBe(2);
    expect(state.renderOptimizationPlan.filters.passBudget).toBe(3);
    expect(state.renderOptimizationRemediationPlan.appliedActions.map((action) => action.type)).toEqual(expect.arrayContaining([
      'capTextureUploads',
      'reduceFilterPasses',
      'captureRenderProfile'
    ]));
    expect(root.querySelector('[data-render-optimization-remediation]')?.textContent).toContain('已应用 3/5');
    expect(app.exportDebugTimeline({ now: Date.UTC(2026, 0, 1) + 40, windowMs: 1000 }).events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'render-optimization-remediation-profile', gate: 'frame-budget' })
    ]));
    expect(app.EditorAPI.exportRenderOptimizationPlan({
      generatedAt: '2026-01-01T00:00:01.000Z'
    }).scheduler.textureUploads.maxUploadsPerFrame).toBe(2);
    expect(messages.map((message) => message.type)).toEqual(expect.arrayContaining([
      'editor:render-optimization-remediation-applied',
      'editor:render-optimization-plan'
    ]));
    app.destroy();
  });

  it('applies complete render optimization remediation plans with an audit report', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const messages = [];
    const app = createEditorApp(root, {
      state: createEditorState({
        dockLayout: {
          left: ['assets'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['render-diagnostics']
        }
      }),
      transport: {
        send: (message) => messages.push(JSON.parse(message))
      }
    });

    app.EditorAPI.refreshRenderDiagnosticsPanel({
      budgets: {
        frameBudgetMs: 16.67,
        drawCallBudget: 4,
        textureUploadBudget: 2,
        filterPassBudget: 3
      },
      frame: { index: 18, cpuMs: 19, gpuMs: 17, fps: 45 },
      draws: [
        { id: 'hero', texture: 'hero.png', material: 'lit', blendMode: 'normal' },
        { id: 'enemy', texture: 'enemy.png', material: 'lit', blendMode: 'normal' },
        { id: 'coin', texture: 'coin.png', material: 'lit', blendMode: 'normal' }
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
    app.EditorAPI.applyRenderDiagnosticsQuickFix('deferTextureUploads', { now: Date.UTC(2026, 0, 1) });
    app.EditorAPI.applyRenderDiagnosticsQuickFix('createAtlas:lit|normal', { now: Date.UTC(2026, 0, 1) + 1 });
    app.EditorAPI.applyRenderDiagnosticsQuickFix('flattenFilterChain', { now: Date.UTC(2026, 0, 1) + 2 });
    const runtimePlan = app.EditorAPI.exportRenderOptimizationPlan({
      generatedAt: '2026-01-01T00:00:00.000Z'
    });
    app.EditorAPI.verifyRenderOptimizationPlan({
      applyReport: {
        schema: 'omnicore.render-optimization-apply-report.v1',
        sourcePlanId: runtimePlan.sourcePlanId,
        status: 'applied',
        applied: runtimePlan.runtimeActions,
        summary: { appliedCount: runtimePlan.runtimeActions.length }
      },
      before: { frameMs: 15.5, drawCalls: 4, textureUploads: 2, filterPasses: 2 },
      after: { frameMs: 23, drawCalls: 9, textureUploads: 5, filterPasses: 5 },
      budgets: { frameMs: 16.67, drawCalls: 4, textureUploads: 2, filterPasses: 3 },
      now: Date.UTC(2026, 0, 1) + 20
    });

    const report = app.EditorAPI.applyRenderOptimizationRemediationPlan({
      now: Date.UTC(2026, 0, 1) + 50
    });

    expect(report).toMatchObject({
      schema: 'omnicore.render-optimization-remediation-apply-report.v1',
      sourcePlanId: runtimePlan.sourcePlanId,
      status: 'applied',
      summary: {
        requestedCount: 5,
        appliedCount: 5,
        skippedCount: 0,
        failedCount: 0
      }
    });
    expect(report.applied.map((entry) => entry.type)).toEqual(expect.arrayContaining([
      'rollbackRenderPlan',
      'rebuildAtlasGroups',
      'capTextureUploads',
      'reduceFilterPasses',
      'captureRenderProfile'
    ]));
    expect(app.getState().renderOptimizationRemediationApplyReport.summary.appliedCount).toBe(5);
    expect(root.querySelector('[data-render-optimization-remediation-report]')?.textContent).toContain('批量应用 5/5');
    expect(app.createRuntimeSyncPayload().renderOptimizationRemediationReport.schema).toBe('omnicore.render-optimization-remediation-apply-report.v1');
    expect(messages.map((message) => message.type)).toContain('editor:render-optimization-remediation-apply-report');
    expect(app.EditorAPI.exportRenderOptimizationPlan({
      generatedAt: '2026-01-01T00:00:02.000Z'
    }).scheduler.textureUploads.maxUploadsPerFrame).toBe(2);
    app.destroy();
  });

  it('reverifies render optimization after remediation has been applied', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const messages = [];
    const app = createEditorApp(root, {
      state: createEditorState({
        dockLayout: {
          left: ['assets'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['render-diagnostics']
        }
      }),
      transport: {
        send: (message) => messages.push(JSON.parse(message))
      }
    });

    app.EditorAPI.refreshRenderDiagnosticsPanel({
      budgets: {
        frameBudgetMs: 16.67,
        drawCallBudget: 4,
        textureUploadBudget: 2,
        filterPassBudget: 3
      },
      frame: { index: 19, cpuMs: 19, gpuMs: 17, fps: 45 },
      draws: [
        { id: 'hero', texture: 'hero.png', material: 'lit', blendMode: 'normal' },
        { id: 'enemy', texture: 'enemy.png', material: 'lit', blendMode: 'normal' },
        { id: 'coin', texture: 'coin.png', material: 'lit', blendMode: 'normal' }
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
    app.EditorAPI.applyRenderDiagnosticsQuickFix('deferTextureUploads', { now: Date.UTC(2026, 0, 1) });
    app.EditorAPI.applyRenderDiagnosticsQuickFix('createAtlas:lit|normal', { now: Date.UTC(2026, 0, 1) + 1 });
    app.EditorAPI.applyRenderDiagnosticsQuickFix('flattenFilterChain', { now: Date.UTC(2026, 0, 1) + 2 });
    const runtimePlan = app.EditorAPI.exportRenderOptimizationPlan({
      generatedAt: '2026-01-01T00:00:00.000Z'
    });
    app.EditorAPI.verifyRenderOptimizationPlan({
      applyReport: {
        schema: 'omnicore.render-optimization-apply-report.v1',
        sourcePlanId: runtimePlan.sourcePlanId,
        status: 'applied',
        applied: runtimePlan.runtimeActions,
        summary: { appliedCount: runtimePlan.runtimeActions.length }
      },
      before: { frameMs: 15.5, drawCalls: 4, textureUploads: 2, filterPasses: 2 },
      after: { frameMs: 23, drawCalls: 9, textureUploads: 5, filterPasses: 5 },
      budgets: { frameMs: 16.67, drawCalls: 4, textureUploads: 2, filterPasses: 3 },
      now: Date.UTC(2026, 0, 1) + 20
    });
    app.EditorAPI.applyRenderOptimizationRemediationPlan({
      now: Date.UTC(2026, 0, 1) + 50
    });

    const reverify = app.EditorAPI.reverifyRenderOptimizationRemediation({
      before: { frameMs: 23, drawCalls: 9, textureUploads: 5, filterPasses: 5 },
      after: { frameMs: 15.9, drawCalls: 4, textureUploads: 2, filterPasses: 2 },
      budgets: { frameMs: 16.67, drawCalls: 4, textureUploads: 2, filterPasses: 3 },
      now: Date.UTC(2026, 0, 1) + 70
    });

    expect(reverify).toMatchObject({
      schema: 'omnicore.render-optimization-remediation-reverify-report.v1',
      sourcePlanId: runtimePlan.sourcePlanId,
      status: 'recovered',
      ok: true,
      previousVerificationStatus: 'failed',
      remediationAppliedCount: 5,
      summary: {
        recoveredGateCount: 4,
        stillFailingGateCount: 0,
        frameMsDelta: -7.1
      }
    });
    expect(reverify.verification).toMatchObject({
      schema: 'omnicore.render-optimization-verification-report.v1',
      status: 'passed',
      ok: true
    });
    expect(app.getState().renderOptimizationRemediationReverifyReport.status).toBe('recovered');
    expect(app.getState().renderOptimizationVerification.status).toBe('passed');
    expect(root.querySelector('[data-render-optimization-remediation-reverify]')?.textContent).toContain('复验通过');
    expect(root.querySelector('[data-render-optimization-remediation-reverify]')?.textContent).toContain('恢复 4/4');
    expect(app.createRuntimeSyncPayload().renderOptimizationRemediationReverify.schema).toBe('omnicore.render-optimization-remediation-reverify-report.v1');
    expect(messages.map((message) => message.type)).toContain('editor:render-optimization-remediation-reverify-report');
    const syncedState = applyLiveSyncMessage(createEditorState(), {
      type: 'editor:render-optimization-remediation-reverify-report',
      payload: reverify
    });
    expect(syncedState.renderOptimizationRemediationReverifyReport.status).toBe('recovered');
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
