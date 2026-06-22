import { describe, expect, it } from 'vitest';
import {
  AssetDependencyTracker,
  AssetImportProfile,
  AssetImportSession,
  AssetRegistry
} from '../src/index.js';

describe('engine asset dependency tracker pack', () => {
  it('queues stale reimports from static, dynamic, and registry dependencies with runtime invalidations', () => {
    const tracker = new AssetDependencyTracker({
      registry: createRegistry(),
      imports: [
        {
          source: 'source-assets/characters/hero.png',
          registryReference: 'texture.hero',
          reimport: {
            cacheKey: 'texture-old',
            inputs: {
              importer: 'texture',
              importerVersion: '4',
              platform: 'web',
              dependencies: ['source-assets/palettes/hero.palette.json']
            }
          },
          dynamicDependencies: ['project-settings/color-space.json'],
          bundle: 'characters'
        },
        {
          source: 'source-assets/prefabs/hero.prefab',
          registryReference: 'prefab.hero',
          reimport: {
            cacheKey: 'prefab-old',
            inputs: {
              importer: 'prefab',
              importerVersion: '2',
              platform: 'web',
              dependencies: ['texture.hero']
            }
          },
          bundle: 'characters'
        },
        {
          source: 'source-assets/models/hero.gltf',
          registryReference: 'model.hero',
          reimport: {
            inputs: {
              importer: 'model',
              importerVersion: '1',
              platform: 'web',
              dependencies: ['source-assets/models/hero.bin']
            }
          },
          bundle: 'characters'
        }
      ],
      knownInputs: [
        'source-assets/characters/hero.png',
        'source-assets/palettes/hero.palette.json',
        'source-assets/prefabs/hero.prefab',
        'project-settings/color-space.json'
      ]
    });

    const report = tracker.analyze([
      { path: 'project-settings/color-space.json', hash: 'new-color-space' }
    ], {
      importerVersions: { texture: '5', prefab: '2', model: '1' },
      platform: 'web',
      entrypoints: ['scene.main']
    });

    expect(report.schema).toBe('omnicore.asset-dependency-tracker-report.v1');
    expect(report.ok).toBe(false);
    expect(report.summary).toMatchObject({
      importCount: 3,
      changedInputCount: 1,
      staleImportCount: 2,
      missingDependencyCount: 1,
      runtimeInvalidationCount: 3,
      reimportQueueCount: 2,
      ready: false
    });
    expect(report.changedInputs).toEqual([
      {
        path: 'project-settings/color-space.json',
        hash: 'new-color-space',
        deleted: false
      }
    ]);
    expect(report.reimportQueue).toEqual([
      {
        source: 'source-assets/characters/hero.png',
        asset: 'texture.hero',
        importer: 'texture',
        bundle: 'characters',
        order: 0,
        reasons: [
          'dynamic-dependency-changed:project-settings/color-space.json',
          'importer-version-changed:texture'
        ]
      },
      {
        source: 'source-assets/prefabs/hero.prefab',
        asset: 'prefab.hero',
        importer: 'prefab',
        bundle: 'characters',
        order: 1,
        reasons: ['registry-dependency-stale:texture.hero']
      }
    ]);
    expect(report.runtimeInvalidations).toEqual([
      {
        type: 'reloadAsset',
        asset: 'texture.hero',
        reason: 'stale-import'
      },
      {
        type: 'reloadAsset',
        asset: 'prefab.hero',
        reason: 'stale-import'
      },
      {
        type: 'refreshAsset',
        asset: 'scene.main',
        reason: 'depends-on:texture.hero'
      }
    ]);
    expect(report.missingDependencies).toEqual([
      {
        source: 'source-assets/models/hero.gltf',
        asset: 'model.hero',
        dependency: 'source-assets/models/hero.bin',
        dependencyType: 'static',
        severity: 'error'
      }
    ]);
    expect(report.crossEngineProfile.capabilities).toEqual([
      'static-dynamic-dependency-tracking',
      'stale-import-detection',
      'topological-reimport-queue',
      'runtime-invalidation-plan',
      'missing-source-dependency-audit',
      'bundle-shared-dependency-awareness'
    ]);
  });

  it('attaches dependency tracking to import sessions so the report is used by the pipeline', async () => {
    const session = new AssetImportSession({
      profile: new AssetImportProfile({
        sourceRoot: 'source-assets',
        outputRoot: 'dist/imported-assets',
        importerVersion: '5',
        presets: [
          {
            name: 'texture-default',
            importer: 'texture',
            extensions: ['.png'],
            output: { folder: 'textures', extension: '.webp' }
          }
        ]
      }),
      registry: createRegistry(),
      current: [
        {
          source: 'source-assets/characters/hero.png',
          registryReference: 'texture.hero',
          output: { path: 'dist/imported-assets/textures/hero.webp' },
          reimport: {
            cacheKey: 'texture-old',
            inputs: {
              importer: 'texture',
              importerVersion: '4',
              platform: 'web',
              dependencies: ['project-settings/color-space.json']
            }
          }
        }
      ],
      importer: async (payload) => ({
        bytes: `bytes:${payload.source}`,
        metadata: { imported: true }
      }),
      writer: async () => ({ written: true })
    });

    const report = await session.run([
      { source: 'source-assets/characters/hero.png', mtimeMs: 2 }
    ], {
      platform: 'web',
      trackDependencies: true,
      dependencyChanges: [{ path: 'project-settings/color-space.json' }],
      dependencyOptions: { importerVersions: { texture: '5' } }
    });

    expect(report.ok).toBe(true);
    expect(report.summary).toMatchObject({
      dependencyStaleCount: 1,
      dependencyMissingCount: 0
    });
    expect(report.dependencyReport).toMatchObject({
      schema: 'omnicore.asset-dependency-tracker-report.v1',
      summary: {
        staleImportCount: 1,
        missingDependencyCount: 0,
        ready: true
      },
      reimportQueue: [
        {
          source: 'source-assets/characters/hero.png',
          asset: 'texture.hero',
          importer: 'texture',
          order: 0,
          reasons: [
            'static-dependency-changed:project-settings/color-space.json',
            'importer-version-changed:texture'
          ]
        }
      ]
    });
  });
});

function createRegistry() {
  return new AssetRegistry({
    assets: [
      {
        uid: 'uid://scene-main',
        primaryId: 'Scene:Main',
        address: 'scene.main',
        path: 'scenes/main.scene.json',
        type: 'Scene',
        dependencies: ['prefab.hero']
      },
      {
        uid: 'uid://hero-prefab',
        primaryId: 'Prefab:Hero',
        address: 'prefab.hero',
        path: 'prefabs/hero.prefab.json',
        type: 'Prefab',
        dependencies: ['texture.hero']
      },
      {
        uid: 'uid://hero-texture',
        primaryId: 'Texture:Hero',
        address: 'texture.hero',
        path: 'dist/imported-assets/textures/hero.webp',
        type: 'Texture'
      },
      {
        uid: 'uid://hero-model',
        primaryId: 'Model:Hero',
        address: 'model.hero',
        path: 'dist/imported-assets/models/hero.glb',
        type: 'Model'
      }
    ]
  });
}
