import { describe, expect, it } from 'vitest';
import {
  BatchAtlasDiagnostics,
  PixiLifecycleAudit,
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
});
