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

  it('previews render optimization runtime plans without touching adapters', () => {
    const calls = [];
    const executor = new RenderOptimizationRuntimeExecutor({
      renderer: { buildAtlas: () => calls.push('atlas') },
      textureManager: { scheduleUpload: () => calls.push('upload') },
      filterPipeline: { flattenFilter: () => calls.push('filter') },
      backendManager: { preferBackend: () => calls.push('backend') },
      renderQueue: [
        { id: 'b', layer: 'world', texture: 'b.png', material: 'lit' },
        { id: 'a', layer: 'world', texture: 'a.png', material: 'lit' }
      ]
    });
    const plan = {
      sourcePlanId: 'render-plan-1',
      scheduler: { textureUploads: { maxUploadsPerFrame: 1 } },
      runtimeActions: [
        { type: 'buildAtlas', key: 'lit|normal', textures: ['a.png', 'b.png'] },
        { type: 'scheduleTextureUpload', id: 'hero', bytes: 1024 },
        { type: 'flattenFilter', id: 'bloom', passes: 2, targetPasses: 1 },
        { type: 'preferBackend', backend: 'webgpu', selected: 'webgl2' },
        { type: 'sortRenderQueueGroup', key: 'lit|normal|a.png' }
      ]
    };

    const preview = executor.previewPlan(plan);
    const dryRun = executor.applyPlan(plan, { dryRun: true });

    expect(calls).toEqual([]);
    expect(preview).toMatchObject({
      schema: 'omnicore.render-optimization-preview.v1',
      sourcePlanId: 'render-plan-1',
      summary: {
        actionCount: 5,
        wouldApplyCount: 5,
        textureUploadBatchCount: 1
      }
    });
    expect(preview.rollbackActions.map((action) => action.type)).toEqual(expect.arrayContaining([
      'destroyAtlas',
      'cancelTextureUpload',
      'restoreFilter',
      'restoreBackend'
    ]));
    expect(preview.auditTrail.map((entry) => entry.phase)).toContain('preview');
    expect(dryRun.summary.dryRun).toBe(true);
    expect(dryRun.applied.every((action) => action.dryRun)).toBe(true);
  });

  it('rolls back applied render optimization runtime plans', () => {
    const calls = [];
    const executor = new RenderOptimizationRuntimeExecutor({
      renderer: {
        buildAtlas: (atlas) => {
          calls.push({ kind: 'atlas', key: atlas.key });
          return { atlasId: `atlas://${atlas.key}` };
        },
        destroyAtlas: (rollback) => {
          calls.push({ kind: 'destroyAtlas', key: rollback.key });
          return { destroyed: rollback.key };
        }
      },
      textureManager: {
        scheduleUpload: (upload) => {
          calls.push({ kind: 'upload', id: upload.id });
          return { queued: upload.id };
        },
        cancelUpload: (rollback) => {
          calls.push({ kind: 'cancelUpload', id: rollback.id });
          return { cancelled: rollback.id };
        }
      },
      filterPipeline: {
        flattenFilter: (filter) => {
          calls.push({ kind: 'filter', id: filter.id });
          return { filter: filter.id };
        },
        restoreFilter: (rollback) => {
          calls.push({ kind: 'restoreFilter', id: rollback.id });
          return { restored: rollback.id };
        }
      },
      backendManager: {
        preferBackend: (backend) => {
          calls.push({ kind: 'backend', backend: backend.backend });
          return { selected: backend.backend };
        },
        restoreBackend: (rollback) => {
          calls.push({ kind: 'restoreBackend', backend: rollback.previousBackend });
          return { selected: rollback.previousBackend };
        }
      }
    });

    const report = executor.applyPlan({
      sourcePlanId: 'render-plan-rollback',
      runtimeActions: [
        { type: 'buildAtlas', key: 'lit|normal', textures: ['a.png', 'b.png'] },
        { type: 'scheduleTextureUpload', id: 'hero', bytes: 1024 },
        { type: 'flattenFilter', id: 'bloom', passes: 2, targetPasses: 1 },
        { type: 'preferBackend', backend: 'webgpu', selected: 'webgl2' }
      ]
    });
    const rollback = executor.rollback(report);

    expect(report.rollbackActions.map((action) => action.type)).toEqual(expect.arrayContaining([
      'destroyAtlas',
      'cancelTextureUpload',
      'restoreFilter',
      'restoreBackend'
    ]));
    expect(rollback).toMatchObject({
      schema: 'omnicore.render-optimization-rollback-report.v1',
      sourcePlanId: 'render-plan-rollback',
      summary: {
        rollbackCount: 4,
        restoredCount: 4,
        failedCount: 0
      }
    });
    expect(calls).toEqual(expect.arrayContaining([
      { kind: 'destroyAtlas', key: 'lit|normal' },
      { kind: 'cancelUpload', id: 'hero' },
      { kind: 'restoreFilter', id: 'bloom' },
      { kind: 'restoreBackend', backend: 'webgl2' }
    ]));
  });

  it('auto-rolls back applied render optimization actions when a later adapter fails', () => {
    const calls = [];
    const executor = new RenderOptimizationRuntimeExecutor({
      renderer: {
        buildAtlas: (atlas) => {
          calls.push({ kind: 'atlas', key: atlas.key });
          return { atlasId: `atlas://${atlas.key}` };
        },
        destroyAtlas: (rollback) => {
          calls.push({ kind: 'destroyAtlas', key: rollback.key });
          return { destroyed: rollback.key };
        }
      },
      filterPipeline: {
        flattenFilter: (filter) => {
          calls.push({ kind: 'filter', id: filter.id });
          throw new Error('filter pipeline offline');
        },
        restoreFilter: (rollback) => {
          calls.push({ kind: 'restoreFilter', id: rollback.id });
          return { restored: rollback.id };
        }
      }
    });

    const report = executor.applyPlan({
      sourcePlanId: 'render-plan-transaction',
      runtimeActions: [
        { type: 'buildAtlas', key: 'lit|normal', textures: ['a.png', 'b.png'] },
        { type: 'flattenFilter', id: 'bloom', passes: 2, targetPasses: 1 }
      ]
    }, { rollbackOnFailure: true });

    expect(report).toMatchObject({
      schema: 'omnicore.render-optimization-apply-report.v1',
      sourcePlanId: 'render-plan-transaction',
      status: 'rolled-back',
      summary: {
        failedCount: 1,
        rollbackOnFailure: true,
        autoRollback: true
      }
    });
    expect(report.failed[0]).toMatchObject({
      type: 'flattenFilter',
      id: 'bloom',
      reason: 'filter pipeline offline'
    });
    expect(report.rollbackReport).toMatchObject({
      schema: 'omnicore.render-optimization-rollback-report.v1',
      summary: {
        rollbackCount: 1,
        restoredCount: 1,
        failedCount: 0
      }
    });
    expect(report.rollbackActions).toEqual([
      expect.objectContaining({ type: 'destroyAtlas', key: 'lit|normal' })
    ]);
    expect(calls).toEqual([
      { kind: 'atlas', key: 'lit|normal' },
      { kind: 'filter', id: 'bloom' },
      { kind: 'destroyAtlas', key: 'lit|normal' }
    ]);
    expect(report.auditTrail.map((entry) => entry.phase)).toEqual(expect.arrayContaining([
      'apply',
      'error',
      'rollback'
    ]));
  });

  it('verifies applied render optimization plans against runtime budgets', () => {
    const executor = new RenderOptimizationRuntimeExecutor();

    const verification = executor.verifyAppliedPlan({
      schema: 'omnicore.render-optimization-apply-report.v1',
      sourcePlanId: 'render-plan-verify',
      status: 'applied',
      applied: [
        { type: 'buildAtlas' },
        { type: 'scheduleTextureUpload' },
        { type: 'flattenFilter' }
      ],
      summary: { appliedCount: 3 }
    }, {
      before: { frameMs: 22, drawCalls: 12, textureUploads: 4, filterPasses: 5 },
      after: { frameMs: 15.8, drawCalls: 6, textureUploads: 2, filterPasses: 2 },
      budgets: { frameMs: 16.67, drawCalls: 8, textureUploads: 2, filterPasses: 3 }
    });

    expect(verification).toMatchObject({
      schema: 'omnicore.render-optimization-verification-report.v1',
      sourcePlanId: 'render-plan-verify',
      ok: true,
      status: 'passed',
      summary: {
        appliedCount: 3,
        savedDrawCalls: 6,
        frameMsDelta: -6.2,
        gatesPassed: 4,
        gatesFailed: 0
      }
    });
    expect(verification.gates).toEqual(expect.arrayContaining([
      { id: 'frame-budget', label: 'Frame budget', ok: true, before: 22, after: 15.8, budget: 16.67, delta: -6.2, improved: true },
      { id: 'draw-call-budget', label: 'Draw call budget', ok: true, before: 12, after: 6, budget: 8, delta: -6, improved: true },
      { id: 'texture-upload-budget', label: 'Texture upload budget', ok: true, before: 4, after: 2, budget: 2, delta: -2, improved: true },
      { id: 'filter-pass-budget', label: 'Filter pass budget', ok: true, before: 5, after: 2, budget: 3, delta: -3, improved: true }
    ]));
    expect(verification.regressions).toEqual([]);
    expect(verification.crossEngineProfile.capabilities).toEqual(expect.arrayContaining([
      'post-apply-budget-verification',
      'before-after-render-evidence',
      'runtime-optimization-gates'
    ]));
  });

  it('flags render optimization verification regressions', () => {
    const executor = new RenderOptimizationRuntimeExecutor();

    const verification = executor.verifyAppliedPlan({
      sourcePlanId: 'render-plan-regression',
      status: 'applied',
      applied: [{ type: 'buildAtlas' }],
      summary: { appliedCount: 1 }
    }, {
      before: { frameMs: 16, drawCalls: 8, textureUploads: 1, filterPasses: 2 },
      after: { frameMs: 20, drawCalls: 9, textureUploads: 3, filterPasses: 4 },
      budgets: { frameMs: 16.67, drawCalls: 8, textureUploads: 2, filterPasses: 3 }
    });

    expect(verification).toMatchObject({
      schema: 'omnicore.render-optimization-verification-report.v1',
      sourcePlanId: 'render-plan-regression',
      ok: false,
      status: 'failed',
      summary: {
        appliedCount: 1,
        savedDrawCalls: 0,
        frameMsDelta: 4,
        gatesPassed: 0,
        gatesFailed: 4
      }
    });
    expect(verification.regressions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'frame-budget', before: 16, after: 20, delta: 4 }),
      expect.objectContaining({ id: 'draw-call-budget', before: 8, after: 9, delta: 1 }),
      expect.objectContaining({ id: 'texture-upload-budget', before: 1, after: 3, delta: 2 }),
      expect.objectContaining({ id: 'filter-pass-budget', before: 2, after: 4, delta: 2 })
    ]));
  });
});
