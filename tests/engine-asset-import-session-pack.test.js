import { describe, expect, it } from 'vitest';
import {
  AssetImportProfile,
  AssetImportSession,
  AssetRegistry,
  AssetRefreshCoordinator
} from '../src/index.js';

describe('engine asset import session pack', () => {
  it('orchestrates preview, transactional import, dependency refresh plan, and runtime refresh', async () => {
    const profile = createProfile();
    const registry = createRegistry();
    const runtimeCalls = [];
    const editorEvents = [];
    const writes = [];
    const session = new AssetImportSession({
      profile,
      registry,
      current: [
        {
          source: 'source-assets/ui/hero.png',
          registryReference: 'texture.hero',
          output: { path: 'dist/imported-assets/textures/hero.webp' },
          reimport: { cacheKey: 'import:old' }
        }
      ],
      importer: async (payload) => ({
        bytes: `bytes:${payload.source}`,
        metadata: { source: payload.source, output: payload.output }
      }),
      writer: {
        write: async (payload) => {
          writes.push(payload);
          return { written: payload.path };
        }
      },
      refreshCoordinator: new AssetRefreshCoordinator({
        handlers: {
          reloadAsset: async (action) => runtimeCalls.push(['reload', action.asset, action.reason]),
          refreshAsset: async (action) => runtimeCalls.push(['refresh', action.asset, action.reason])
        },
        editorBus: {
          emit: async (type, event) => editorEvents.push({ type, event })
        }
      })
    });

    const report = await session.run([
      { source: 'source-assets/ui/hero.png', labels: ['ui'], mtimeMs: 2 }
    ], { platform: 'web' });

    expect(report.schema).toBe('omnicore.asset-import-session-report.v1');
    expect(report.ok).toBe(true);
    expect(report.summary).toMatchObject({
      ok: true,
      dryRun: false,
      assetCount: 1,
      previewOk: true,
      transactionOk: true,
      refreshOk: true,
      importedCount: 1,
      skippedCount: 0,
      blockedCount: 0,
      failedCount: 0,
      runtimeActionCount: 3,
      editorEventCount: 1
    });
    expect(writes.map((payload) => payload.path)).toEqual([
      'dist/imported-assets/textures/hero.webp'
    ]);
    expect(report.changePlan).toMatchObject({
      schema: 'omnicore.asset-registry-change-plan.v1',
      directAssets: ['texture.hero'],
      affectedAssets: ['prefab.hero', 'scene.main'],
      runtimeActions: [
        {
          type: 'reloadAsset',
          asset: 'texture.hero',
          reason: 'modified'
        },
        {
          type: 'refreshAsset',
          asset: 'prefab.hero',
          reason: 'depends-on:texture.hero'
        },
        {
          type: 'refreshAsset',
          asset: 'scene.main',
          reason: 'depends-on:texture.hero'
        }
      ]
    });
    expect(runtimeCalls).toEqual([
      ['reload', 'texture.hero', 'modified'],
      ['refresh', 'prefab.hero', 'depends-on:texture.hero'],
      ['refresh', 'scene.main', 'depends-on:texture.hero']
    ]);
    expect(editorEvents.map((event) => event.type)).toEqual(['asset:changed']);
    expect(report.crossEngineProfile.capabilities).toEqual([
      'import-session-orchestration',
      'one-click-reimport-refresh',
      'dependency-refresh-plan',
      'editor-runtime-refresh-bridge',
      'dry-run-import-plan',
      'failure-propagation-with-rollback'
    ]);
  });

  it('can dry-run the import session without touching importer, writer, or refresh handlers', async () => {
    let importCount = 0;
    const session = new AssetImportSession({
      profile: createProfile(),
      importer: async () => {
        importCount += 1;
        return { bytes: 'not-used' };
      }
    });

    const report = await session.run([
      { source: 'source-assets/icons/play.png', labels: ['ui'], mtimeMs: 1 }
    ], { apply: false, platform: 'web' });

    expect(importCount).toBe(0);
    expect(report.ok).toBe(true);
    expect(report.summary).toMatchObject({
      ok: true,
      dryRun: true,
      assetCount: 1,
      previewOk: true,
      transactionOk: null,
      refreshOk: null,
      plannedImportCount: 1,
      importedCount: 0
    });
    expect(report.preview.steps).toEqual([
      {
        type: 'import',
        action: 'create',
        source: 'source-assets/icons/play.png',
        output: 'dist/imported-assets/textures/play.webp'
      }
    ]);
    expect(report.transaction).toBe(null);
    expect(report.changePlan).toBe(null);
    expect(report.refreshReport).toBe(null);
  });

  it('propagates blocked preview failures and avoids refresh when the transaction cannot apply', async () => {
    let refreshCount = 0;
    const session = new AssetImportSession({
      profile: new AssetImportProfile({
        sourceRoot: 'source-assets',
        outputRoot: 'source-assets/generated',
        presets: [
          {
            name: 'texture-loop-risk',
            importer: 'texture',
            extensions: ['.png'],
            output: { folder: 'textures', extension: '.webp' }
          }
        ]
      }),
      importer: async () => ({ bytes: 'not-written' }),
      refreshCoordinator: {
        apply: async () => {
          refreshCount += 1;
          return { ok: true };
        }
      }
    });

    const report = await session.run([
      { source: 'source-assets/hero.png', mtimeMs: 1 }
    ]);

    expect(refreshCount).toBe(0);
    expect(report.ok).toBe(false);
    expect(report.summary).toMatchObject({
      ok: false,
      dryRun: false,
      assetCount: 1,
      previewOk: false,
      transactionOk: false,
      refreshOk: null,
      importedCount: 0,
      blockedCount: 1,
      failedCount: 1
    });
    expect(report.failures).toEqual([
      {
        phase: 'blocked',
        source: 'source-assets/hero.png',
        reason: 'reimport-loop-risk',
        message: 'Blocked import step: reimport-loop-risk',
        step: {
          type: 'blocked',
          source: 'source-assets/hero.png',
          reason: 'reimport-loop-risk'
        }
      }
    ]);
    expect(report.changePlan).toBe(null);
    expect(report.refreshReport).toBe(null);
  });
});

function createProfile() {
  return new AssetImportProfile({
    sourceRoot: 'source-assets',
    outputRoot: 'dist/imported-assets',
    importerVersion: '4',
    presets: [
      {
        name: 'texture-default',
        importer: 'texture',
        extensions: ['.png'],
        output: {
          folder: 'textures',
          extension: '.webp',
          bundle: 'textures'
        }
      }
    ]
  });
}

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
      }
    ]
  });
}
