import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  RendererContract,
  WebGPURenderer,
  createRendererPerformanceSandbox,
  createWebGPUComputeParticleDescriptor
} from '../src/index.js';

let createEditorApp;
let createEditorState;
let createCollaborationSession;

beforeAll(async () => {
  ({ createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href));
  ({ createEditorState } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/live-sync-protocol.js')).href));
  ({ createCollaborationSession } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/collaboration.js')).href));
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('tricore industrial expansion', () => {
  it('declares the standalone web editor stack and exports bidirectional low-code runtime payloads', () => {
    const editorPackage = JSON.parse(readFileSync('packages/omnicore-editor/package.json', 'utf8'));
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        dockLayout: { left: ['hierarchy'], center: ['scene-view'], right: ['inspector'], bottom: ['graph-editor', 'ui-editor'] }
      })
    });

    app.EditorAPI.createNPCProximityRecipe({ npcId: 'merchant', playerId: 'hero', dialog: '交易' });
    app.EditorAPI.addUIButton({ id: 'buy', text: '购买', action: 'shop:buy', layout: { flex: 1 } });

    const payload = app.createRuntimeSyncPayload();

    expect(editorPackage.omnicoreEditor.stack).toEqual(expect.objectContaining({
      view: 'React',
      graph: 'React Flow',
      canvas: expect.arrayContaining(['Fabric.js', 'Konva.js']),
      collaboration: 'Yjs',
      state: 'Zustand'
    }));
    expect(editorPackage.omnicoreEditor.transports).toEqual(expect.arrayContaining(['WebSocket', 'WebRTC']));
    expect(payload).toMatchObject({
      protocol: 'omnicore-editor-runtime-sync/v1',
      eventSheet: { format: 'OmniCore.EventSheet' },
      behaviorTree: { type: 'selector' },
      uiLayout: { format: 'OmniCore.UI_Layout' }
    });
    expect(app.applyRuntimeSyncPayload(payload).flowGraph.nodes.length).toBeGreaterThan(0);
    app.destroy();
  });

  it('supports collaborative object locks and IndexedDB/Git-style version branches', () => {
    const alice = createCollaborationSession({ clientId: 'alice' });
    const bob = createCollaborationSession({ clientId: 'bob' });

    expect(alice.lockObject('entity:hero')).toMatchObject({ ok: true, owner: 'alice' });
    expect(bob.applyUpdate(alice.encodeStateAsUpdate()).lockObject('entity:hero')).toMatchObject({
      ok: false,
      owner: 'alice'
    });
    alice.transact((doc) => doc.placeMonster({ id: 'slime', x: 4, y: 8 }));
    const branch = alice.createVersionBranch('feature/slime-patrol', { storage: 'indexeddb+git' });

    expect(branch).toMatchObject({
      name: 'feature/slime-patrol',
      storage: 'indexeddb+git',
      snapshot: expect.objectContaining({ monsters: [expect.objectContaining({ id: 'slime' })] })
    });
    alice.rollbackBranch('feature/slime-patrol');
    expect(alice.snapshot().activeBranch).toBe('feature/slime-patrol');
  });

  it('builds industrial editor diagnostics for dependencies, incremental hot reload, timelines, state machines, prefabs, and nested scenes', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        assets: [
          { path: 'assets/hero.webp', type: 'image' },
          { path: 'assets/slime.webp', type: 'image' }
        ],
        scene: {
          name: 'town',
          entities: [
            { id: 'hero', sprite: 'assets/hero.webp', prefabId: 'hero-base' },
            { id: 'slime', sprite: 'assets/slime.webp', scene: 'scenes/slime-ai.json' }
          ]
        },
        projectFiles: {
          'scenes/town.json': '{"sprite":"assets/hero.webp"}',
          'prefabs/hero.json': '{"sprite":"assets/hero.webp"}'
        },
        prefabs: [{ id: 'hero-base', hp: 10, damage: 2 }]
      })
    });

    const graph = app.buildAssetDependencyGraph();
    const replacement = app.replaceAssetReferences('assets/hero.webp', 'assets/hero-v2.webp');
    const compile = app.runIncrementalCompile(['scenes/town.json', 'prefabs/hero.json']);
    app.recordDebugEvent({ type: 'event', name: 'hit', at: 10_500 });
    app.recordProfilerFrame({ frame: 1, totalMs: 18, sections: [{ name: 'GPU', duration: 11 }], gpuMs: 11, cpuMs: 7 });
    const timeline = app.exportDebugTimeline({ now: 11_000 });
    const stateMachine = app.exportAnimationStateMachine({
      id: 'hero-combat',
      states: [{ id: 'idle' }, { id: 'attack' }],
      transitions: [{ from: 'idle', to: 'attack', condition: 'input.attack' }]
    });
    const variant = app.EditorAPI.createPrefabVariant('hero-base', { id: 'hero-fire', damage: 8 });
    const nested = app.instantiateNestedScene('scenes/dungeon.json', { id: 'dungeon-01', x: 128, y: 64 });

    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'scenes/town.json', to: 'assets/hero.webp' }),
      expect.objectContaining({ from: 'entity:slime', to: 'scenes/slime-ai.json' })
    ]));
    expect(replacement.changedFiles).toEqual(['scenes/town.json', 'prefabs/hero.json']);
    expect(compile.hotReloadManifest.changedFiles).toEqual(['scenes/town.json', 'prefabs/hero.json']);
    expect(timeline.events[0].name).toBe('hit');
    expect(timeline.profiler.hotspots[0]).toMatchObject({ name: 'GPU', duration: 11 });
    expect(stateMachine.transitions[0].condition).toBe('input.attack');
    expect(variant.overrides.damage).toBe(8);
    expect(nested).toMatchObject({ type: 'NestedScene', scenePath: 'scenes/dungeon.json' });
    app.destroy();
  });

  it('provides unified renderer contracts, WebGPU shader prewarm, compute particles, and a performance sandbox', async () => {
    const renderer = new WebGPURenderer({
      canvas: { getContext: () => ({ configure: () => {} }) },
      gpu: {
        requestAdapter: async () => ({
          requestDevice: async () => ({
            createShaderModule: (descriptor) => ({ descriptor }),
            createRenderPipeline: (descriptor) => ({ descriptor, type: 'render' }),
            createComputePipeline: (descriptor) => ({ descriptor, type: 'compute' }),
            queue: { submit: () => {} }
          })
        }),
        getPreferredCanvasFormat: () => 'bgra8unorm'
      }
    });

    await renderer.init();
    const prewarm = renderer.prewarmShaderCache();
    const particles = renderer.createComputeParticlePipeline({ maxParticles: 4096 });
    const sandbox = createRendererPerformanceSandbox([
      { name: 'pixi', fps: 58, powerMw: 900 },
      { name: 'webgpu', fps: 60, powerMw: 720 }
    ]);

    expect(RendererContract.requiredMethods).toEqual(['init', 'renderScene', 'resize', 'fade', 'destroy']);
    expect(prewarm).toMatchObject({ backend: 'webgpu', warmed: true, pipelines: expect.arrayContaining(['2d-instanced']) });
    expect(particles).toMatchObject({ backend: 'webgpu', maxParticles: 4096, pipeline: expect.objectContaining({ type: 'compute' }) });
    expect(createWebGPUComputeParticleDescriptor({ maxParticles: 128 }).wgsl).toContain('@compute');
    expect(sandbox.winner.name).toBe('webgpu');
    renderer.destroy();
  });
});
