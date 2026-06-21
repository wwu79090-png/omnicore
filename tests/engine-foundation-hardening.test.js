import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  AssetPipelineGate,
  PrefabManager,
  SceneDocument,
  collectSceneDependencies,
  compareRenderSnapshots,
  createAssetPipelineReport,
  createDeterministicRenderQueue,
  normalizeSceneDocument,
  snapshotRenderQueue,
  validateSceneDocument
} from '../src/index.js';
import { createTypeDeclarationSource } from '../scripts/build.js';
import { createProductionReadyReport, DEFAULT_VERIFY_SCRIPTS } from '../scripts/production-ready.js';

describe('engine foundation hardening pack', () => {
  it('migrates legacy scene JSON into a versioned scene document and collects dependencies', () => {
    const legacyScene = {
      version: 0,
      name: 'lab',
      objects: [
        {
          id: 'hero',
          type: 'sprite',
          texture: 'hero.png',
          x: 12,
          y: 24,
          zIndex: 2,
          components: {
            Health: { hp: 3 }
          },
          children: [
            {
              id: 'shadow',
              type: 'sprite',
              texture: 'shadow.png',
              x: 0,
              y: 16
            }
          ]
        }
      ],
      assets: {
        audio: ['click.ogg'],
        fonts: ['NotoSansSC']
      }
    };

    const document = normalizeSceneDocument(legacyScene);

    expect(document).toMatchObject({
      schema: 'omnicore.scene-document.v1',
      schemaVersion: 1,
      name: 'lab'
    });
    expect(document.children[0]).toMatchObject({
      id: 'hero',
      type: 'sprite',
      texture: 'hero.png',
      transform: {
        x: 12,
        y: 24,
        z: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1
      },
      components: [{ type: 'Health', options: { hp: 3 } }]
    });

    expect(validateSceneDocument(document)).toMatchObject({ ok: true, errors: [] });
    expect(collectSceneDependencies(document)).toEqual({
      audio: ['click.ogg'],
      data: [],
      fonts: ['NotoSansSC'],
      images: ['hero.png', 'shadow.png'],
      models: [],
      prefabs: []
    });
    expect(new SceneDocument(document).toJSON()).toEqual(document);
  });

  it('fails resource-pipeline gates for budget, hash, missing asset, and cycle violations', () => {
    const report = createAssetPipelineReport({
      manifest: {
        assets: [
          { key: 'hero.png', type: 'image', size: 3 * 1024 * 1024, hash: 'hero-hash' },
          { key: 'music.ogg', type: 'audio', size: 2 * 1024 * 1024 }
        ],
        dependencies: {
          'scene/main': ['hero.png', 'missing.png'],
          'hero.png': ['music.ogg'],
          'music.ogg': ['hero.png']
        },
        deadResources: ['unused.png']
      },
      budgets: {
        totalBytes: 4 * 1024 * 1024,
        byType: {
          image: 2 * 1024 * 1024
        }
      },
      required: ['hero.png', 'zh.fnt']
    });

    expect(report.ok).toBe(false);
    expect(report.failures.map((failure) => failure.code)).toEqual(expect.arrayContaining([
      'asset-budget-exceeded',
      'asset-type-budget-exceeded',
      'asset-missing-hash',
      'asset-reference-missing',
      'asset-required-missing',
      'asset-dependency-cycle'
    ]));
    expect(report.topFiles[0]).toMatchObject({ key: 'hero.png', size: 3 * 1024 * 1024 });
    expect(report.deadResources).toEqual(['unused.png']);
    expect(() => new AssetPipelineGate({ report }).assert()).toThrow(/asset-budget-exceeded/);
  });

  it('creates deterministic render queues and comparable stable snapshots', () => {
    const firstInput = [
      { id: 'hero-b', layer: 'world', zIndex: 2, y: 24, x: 8, texture: 'hero.png' },
      { id: 'hud', layer: 'ui', zIndex: 0, y: 0, x: 0 },
      { id: 'hero-a', layer: 'world', zIndex: 2, y: 24, x: 4, texture: 'hero.png' },
      { id: 'bg', layer: 'background', zIndex: -1, y: 0, x: 0 }
    ];
    const secondInput = [...firstInput].reverse();

    const queueA = createDeterministicRenderQueue(firstInput, {
      layerOrder: ['background', 'world', 'ui']
    });
    const queueB = createDeterministicRenderQueue(secondInput, {
      layerOrder: ['background', 'world', 'ui']
    });

    expect(queueA.map((entry) => entry.id)).toEqual(['bg', 'hero-a', 'hero-b', 'hud']);
    expect(queueB.map((entry) => entry.id)).toEqual(['bg', 'hero-a', 'hero-b', 'hud']);
    expect(snapshotRenderQueue(queueA)).toMatchObject({
      schema: 'omnicore.render-queue-snapshot.v1',
      order: ['bg', 'hero-a', 'hero-b', 'hud']
    });
    expect(compareRenderSnapshots(snapshotRenderQueue(queueA), snapshotRenderQueue(queueB))).toEqual({
      ok: true,
      firstMismatch: null
    });
  });

  it('validates prefab structure and exposes prefab dependencies for the asset pipeline', () => {
    const prefab = {
      name: 'Hero',
      type: 'sprite',
      texture: 'hero.png',
      props: {
        normalMap: 'hero_n.png',
        font: 'NotoSansSC'
      },
      components: [
        { type: 'Health', options: { icon: 'heart.png' } }
      ],
      children: [
        { name: 'Weapon', type: 'sprite', texture: 'sword.png' },
        { name: 'Voice', type: 'audio', src: 'hero.ogg' }
      ]
    };

    expect(PrefabManager.validate(prefab)).toMatchObject({ ok: true, errors: [] });
    expect(PrefabManager.collectDependencies(prefab)).toEqual({
      audio: ['hero.ogg'],
      data: [],
      fonts: ['NotoSansSC'],
      images: ['heart.png', 'hero.png', 'hero_n.png', 'sword.png'],
      models: [],
      prefabs: []
    });

    const invalid = {
      name: 'Invalid',
      type: 'sprite',
      children: [
        { name: 'Dup', type: 'node' },
        { name: 'Dup', type: 'node' }
      ]
    };

    expect(PrefabManager.validate(invalid).errors).toContainEqual(expect.objectContaining({
      code: 'duplicate-child-name',
      path: 'Invalid/Dup'
    }));
  });

  it('publishes declarations for foundation hardening APIs', () => {
    const declarations = createTypeDeclarationSource();

    expect(declarations).toContain('export class SceneDocument');
    expect(declarations).toContain('export function normalizeSceneDocument');
    expect(declarations).toContain('export class AssetPipelineGate');
    expect(declarations).toContain('export function createDeterministicRenderQueue');
    expect(declarations).toContain('collectDependencies(json: Record<string, unknown>):');
  });

  it('wires foundation gates into release verification and package scripts', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const report = createProductionReadyReport({
      generatedAt: '2026-06-21T00:00:00.000Z'
    });

    expect(packageJson.scripts['foundation:gate']).toBe('node scripts/foundation-gate.js');
    expect(DEFAULT_VERIFY_SCRIPTS).toContain('foundation:gate');
    expect(report.foundationGates).toMatchObject({
      ok: true,
      sceneDocuments: expect.objectContaining({
        checked: expect.any(Number),
        failures: []
      }),
      assetPipeline: expect.objectContaining({
        ok: true,
        failures: []
      }),
      renderSnapshots: expect.objectContaining({
        checked: expect.any(Number),
        failures: []
      })
    });
    expect(report.findings.some((item) => item.message.includes('foundation gate failed'))).toBe(false);
  });
});
