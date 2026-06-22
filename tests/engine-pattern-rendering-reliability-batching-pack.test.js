import { describe, expect, it } from 'vitest';
import {
  BatchAtlasDiagnostics,
  PixiLifecycleAudit,
  RenderOptimizationRuntimeExecutor,
  RendererBackendContract,
  RenderWorkerOwnership
} from '../src/index.js';

describe('engine pattern rendering reliability batching pack', () => {
  it('resolves renderer backend contracts with deterministic fallback reasons', () => {
    const contract = new RendererBackendContract({
      backends: [
        { id: 'webgpu', priority: 0, available: false, reason: 'adapter-missing' },
        { id: 'webgl2', priority: 1, available: true, reason: 'context-ok', features: ['instancing', 'float-texture'] },
        { id: 'canvas', priority: 2, available: true, reason: '2d-context-ok' }
      ]
    });

    expect(contract.resolve({ preferred: 'webgpu', requiredFeatures: ['instancing'] })).toEqual({
      preferred: 'webgpu',
      selected: 'webgl2',
      fallbackChain: ['webgpu', 'webgl2', 'canvas'],
      accepted: { id: 'webgl2', reason: 'context-ok', features: ['instancing', 'float-texture'] },
      rejected: [
        { id: 'webgpu', reason: 'adapter-missing' }
      ]
    });
  });

  it('diagnoses render worker ownership and unsafe command transfer boundaries', () => {
    const ownership = new RenderWorkerOwnership({
      offscreenCanvas: true,
      transferableBuffers: true,
      backend: 'webgpu'
    });

    expect(ownership.plan({
      commands: [
        { type: 'draw', payload: { buffer: new ArrayBuffer(8) } },
        { type: 'measureText', touchesDom: true },
        { type: 'uploadTexture', transferable: true }
      ]
    })).toEqual({
      owner: 'hybrid',
      workerStages: ['uploadTexture', 'draw'],
      mainStages: ['measureText'],
      transferable: true,
      violations: [
        { type: 'measureText', reason: 'dom-bound-command' }
      ],
      recommendation: 'split-dom-bound-commands'
    });
  });

  it('finds draw-call breaks, material switches, and atlas candidates', () => {
    const diagnostics = new BatchAtlasDiagnostics();
    const report = diagnostics.analyze([
      { id: 'hero', texture: 'hero.png', material: 'lit', blendMode: 'normal' },
      { id: 'enemy', texture: 'enemy.png', material: 'lit', blendMode: 'normal' },
      { id: 'spark', texture: 'fx.png', material: 'additive', blendMode: 'add' },
      { id: 'coin', texture: 'coin.png', material: 'lit', blendMode: 'normal' },
      { id: 'ui', texture: 'ui.png', material: 'ui', blendMode: 'normal', dynamic: true }
    ]);

    expect(report).toMatchObject({
      drawCallsBefore: 5,
      predictedDrawCallsAfter: 4,
      materialSwitches: 4,
      atlasCandidates: [
        { key: 'lit|normal', textures: ['coin.png', 'enemy.png', 'hero.png'], spriteCount: 3 }
      ],
      recommendations: [
        'createAtlas:lit|normal',
        'sortByMaterialTexture',
        'keepDynamicSpritesOutOfStaticBatches'
      ]
    });
    expect(report.batchBreaks.map((entry) => entry.reason)).toEqual([
      'texture-switch',
      'material-switch',
      'material-switch',
      'dynamic-sprite'
    ]);
  });

  it('audits Pixi lifecycle order and texture release risks', () => {
    const audit = new PixiLifecycleAudit();
    const report = audit.inspect([
      { type: 'app:init' },
      { type: 'texture:retain', id: 'hero' },
      { type: 'texture:retain', id: 'enemy' },
      { type: 'texture:release', id: 'hero' },
      { type: 'renderer:destroy' }
    ]);

    expect(report).toEqual({
      status: 'leak-risk',
      initialized: true,
      destroyed: true,
      leakedTextures: ['enemy'],
      orderViolations: [],
      recommendations: ['releaseTexture:enemy']
    });
    expect(audit.inspect([
      { type: 'texture:retain', id: 'hero' },
      { type: 'app:init' }
    ]).orderViolations).toEqual([
      { type: 'texture:retain', reason: 'before-app-init' }
    ]);
  });

  it('creates editor-ready render frame budget reports with filter and texture risks', () => {
    const diagnostics = new BatchAtlasDiagnostics({
      frameBudgetMs: 16.67,
      drawCallBudget: 4,
      textureUploadBudget: 2,
      filterPassBudget: 3
    });

    const report = diagnostics.createFrameBudgetReport({
      frame: { index: 42, cpuMs: 18.2, gpuMs: 14.5, fps: 52 },
      backend: {
        selected: 'webgl2',
        fallbackChain: ['webgpu', 'webgl2'],
        rejected: [{ id: 'webgpu', reason: 'adapter-missing' }]
      },
      draws: [
        { id: 'hero', texture: 'hero.png', material: 'lit', blendMode: 'normal' },
        { id: 'enemy', texture: 'enemy.png', material: 'lit', blendMode: 'normal' },
        { id: 'spark', texture: 'fx.png', material: 'additive', blendMode: 'add' },
        { id: 'coin', texture: 'coin.png', material: 'lit', blendMode: 'normal' },
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

    expect(report.schema).toBe('omnicore.render-frame-budget-report.v1');
    expect(report.summary).toMatchObject({
      frameIndex: 42,
      fps: 52,
      cpuMs: 18.2,
      gpuMs: 14.5,
      frameBudgetMs: 16.67,
      overBudget: true,
      severity: 'warning',
      drawCallsBefore: 5,
      predictedDrawCallsAfter: 4,
      textureUploadCount: 3,
      textureUploadBytes: 7168,
      filterPassCount: 4,
      filterMs: 3.5,
      backend: 'webgl2'
    });
    expect(report.issues).toEqual(expect.arrayContaining([
      { type: 'cpu-budget-exceeded', severity: 'warning', value: 18.2, budget: 16.67 },
      { type: 'texture-upload-spike', severity: 'warning', value: 3, budget: 2 },
      { type: 'filter-pass-budget-exceeded', severity: 'warning', value: 4, budget: 3 },
      { type: 'backend-fallback', severity: 'info', value: 'webgpu', reason: 'adapter-missing' }
    ]));
    expect(report.recommendations).toEqual(expect.arrayContaining([
      'createAtlas:lit|normal',
      'sortByMaterialTexture',
      'deferTextureUploads',
      'flattenFilterChain',
      'preferWebGPUWhenAvailable'
    ]));
    expect(report.editorPanels).toEqual([
      'frame-budget',
      'batch-breaks',
      'texture-uploads',
      'filter-costs',
      'backend-fallback'
    ]);
    expect(report.crossEngineProfile.capabilities).toEqual(expect.arrayContaining([
      'frame-budget-overlay',
      'texture-upload-spike-detection',
      'filter-pass-cost-audit'
    ]));
  });

  it('applies render optimization runtime plans to renderer resource adapters', () => {
    const calls = [];
    const executor = new RenderOptimizationRuntimeExecutor({
      renderer: {
        buildAtlas: (atlas) => {
          calls.push({ kind: 'atlas', key: atlas.key, textures: atlas.textures });
          return { atlasId: `atlas://${atlas.key}` };
        },
        splitDynamicSpriteBatch: (sprite) => {
          calls.push({ kind: 'dynamic', id: sprite.id });
          return { isolated: sprite.id };
        }
      },
      textureManager: {
        scheduleUpload: (upload, context) => {
          calls.push({ kind: 'upload', id: upload.id, frameOffset: context.frameOffset });
          return { queued: upload.id, frameOffset: context.frameOffset };
        }
      },
      filterPipeline: {
        flattenFilter: (filter) => {
          calls.push({ kind: 'filter', id: filter.id, targetPasses: filter.targetPasses });
          return { filter: filter.id, targetPasses: filter.targetPasses };
        }
      },
      backendManager: {
        preferBackend: (backend) => {
          calls.push({ kind: 'backend', backend: backend.backend });
          return { selected: backend.backend };
        }
      },
      renderQueue: [
        { id: 'b', layer: 'world', texture: 'b.png', material: 'lit', blendMode: 'normal' },
        { id: 'a', layer: 'world', texture: 'a.png', material: 'lit', blendMode: 'normal' },
        { id: 'c', layer: 'world', texture: 'a.png', material: 'lit', blendMode: 'normal' }
      ]
    });

    const report = executor.applyPlan({
      schema: 'omnicore.render-optimization-runtime.v1',
      scheduler: {
        textureUploads: { maxUploadsPerFrame: 2 }
      },
      runtimeActions: [
        { type: 'buildAtlas', key: 'lit|normal', textures: ['a.png', 'b.png'], material: 'lit', blendMode: 'normal' },
        { type: 'scheduleTextureUpload', id: 'hero', bytes: 1024, strategy: 'warmup-or-frame-split' },
        { type: 'scheduleTextureUpload', id: 'enemy', bytes: 2048, strategy: 'warmup-or-frame-split' },
        { type: 'scheduleTextureUpload', id: 'ui', bytes: 4096, strategy: 'warmup-or-frame-split' },
        { type: 'flattenFilter', id: 'bloom', passes: 2, targetPasses: 1, estimatedMs: 1.4 },
        { type: 'preferBackend', backend: 'webgpu', fallbackChain: ['webgpu', 'webgl2'] },
        { type: 'sortRenderQueueGroup', key: 'lit|normal|a.png' },
        { type: 'splitDynamicSpriteBatch', id: 'ui-hud', texture: 'ui.png' }
      ]
    });

    expect(report.schema).toBe('omnicore.render-optimization-apply-report.v1');
    expect(report.applied.map((action) => action.type)).toEqual(expect.arrayContaining([
      'buildAtlas',
      'scheduleTextureUpload',
      'flattenFilter',
      'preferBackend',
      'sortRenderQueueGroup',
      'splitDynamicSpriteBatch'
    ]));
    expect(report.textureUploadBatches.map((batch) => batch.uploads.map((upload) => upload.id))).toEqual([
      ['hero', 'enemy'],
      ['ui']
    ]);
    expect(calls).toEqual(expect.arrayContaining([
      { kind: 'atlas', key: 'lit|normal', textures: ['a.png', 'b.png'] },
      { kind: 'upload', id: 'hero', frameOffset: 0 },
      { kind: 'upload', id: 'ui', frameOffset: 1 },
      { kind: 'filter', id: 'bloom', targetPasses: 1 },
      { kind: 'backend', backend: 'webgpu' },
      { kind: 'dynamic', id: 'ui-hud' }
    ]));
    expect(report.renderQueue.afterDrawCalls).toBeLessThanOrEqual(report.renderQueue.beforeDrawCalls);
    expect(report.crossEngineProfile.capabilities).toEqual(expect.arrayContaining([
      'runtime-plan-application',
      'texture-upload-frame-splitting',
      'batch-aware-render-queue-application'
    ]));
  });
});
