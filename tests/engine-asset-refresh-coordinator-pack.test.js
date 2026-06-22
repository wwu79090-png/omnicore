import { describe, expect, it } from 'vitest';
import { createAssetWatchServer } from '../scripts/asset-watch-server.js';
import { AssetRefreshCoordinator, AssetRegistry, AssetRegistryChangeSet } from '../src/index.js';
import { ResourceHMRClient } from '../src/assets/ResourceHMRClient.js';

describe('engine asset refresh coordinator pack', () => {
  it('applies dependency-aware asset change plans to runtime handlers, editor events, and hmr payloads', async () => {
    const plan = createTextureChangePlan();
    const runtimeCalls = [];
    const editorEvents = [];
    const sentMessages = [];

    const coordinator = new AssetRefreshCoordinator({
      handlers: {
        reloadAsset: async (action) => runtimeCalls.push(['reload', action.asset, action.reason]),
        preloadAsset: async (action) => runtimeCalls.push(['preload', action.asset, action.reason]),
        refreshAsset: async (action) => runtimeCalls.push(['refresh', action.asset, action.reason])
      },
      editorBus: {
        emit: (type, event) => editorEvents.push({ type, event })
      },
      websocket: {
        send: (message) => sentMessages.push(JSON.parse(message))
      }
    });

    const result = await coordinator.apply(plan);

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({
      schema: 'omnicore.asset-refresh-apply-report.v1',
      runtimeActionCount: 4,
      runtimeAppliedCount: 4,
      runtimeSkippedCount: 0,
      runtimeFailedCount: 0,
      editorEventCount: 2,
      editorFailedCount: 0,
      hmrSent: true
    });
    expect(runtimeCalls).toEqual([
      ['reload', 'texture.hero', 'modified'],
      ['preload', 'texture.enemy', 'imported'],
      ['refresh', 'prefab.hero', 'depends-on:texture.hero'],
      ['refresh', 'scene.main', 'depends-on:texture.hero']
    ]);
    expect(editorEvents.map((entry) => entry.type)).toEqual(['asset:changed', 'asset:imported']);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toMatchObject({
      type: 'assets:hot-update',
      incremental: true,
      files: ['texture.enemy', 'texture.hero'],
      changePlan: {
        schema: 'omnicore.asset-registry-change-plan.v1'
      },
      runtimeActions: plan.runtimeActions,
      editorEvents: plan.editorEvents
    });
  });

  it('reports failed runtime handlers with action context instead of hiding the failure', async () => {
    const plan = createTextureChangePlan();
    const coordinator = new AssetRefreshCoordinator({
      handlers: {
        reloadAsset: async () => {
          throw new Error('texture upload failed');
        },
        preloadAsset: async () => {},
        refreshAsset: async () => {}
      }
    });

    const result = await coordinator.apply(plan, { sendHmr: false });

    expect(result.ok).toBe(false);
    expect(result.summary.runtimeFailedCount).toBe(1);
    expect(result.summary.hmrSent).toBe(false);
    expect(result.failures).toEqual([
      {
        phase: 'runtime',
        action: {
          type: 'reloadAsset',
          asset: 'texture.hero',
          reason: 'modified'
        },
        message: 'texture upload failed'
      }
    ]);
  });

  it('lets HMR clients apply change plans through a refresh coordinator while preserving patch output', async () => {
    const plan = createTextureChangePlan();
    const appliedPatches = [];
    const coordinatorCalls = [];
    const client = new ResourceHMRClient({
      patchManager: {
        apply: async (patch) => appliedPatches.push(patch)
      },
      changeCoordinator: {
        apply: async (receivedPlan, options) => {
          coordinatorCalls.push({ plan: receivedPlan, options });
          return { ok: true, applied: true };
        }
      }
    });

    const patch = await client.accept({
      type: 'assets:hot-update',
      files: ['texture.hero'],
      conversions: [{ file: 'texture.hero', output: 'texture.hero.webp' }],
      changePlan: plan
    });

    expect(appliedPatches[0]).toMatchObject({
      format: 'OmniCore.OTAPatch',
      files: {
        'texture.hero': expect.any(Object)
      }
    });
    expect(coordinatorCalls).toEqual([
      {
        plan,
        options: { sendHmr: false }
      }
    ]);
    expect(patch.refreshReport).toEqual({ ok: true, applied: true });
  });

  it('lets asset watch servers attach dependency change plans to hot-update payloads', async () => {
    const plan = createTextureChangePlan();
    const pushedMessages = [];
    const plannerCalls = [];
    const server = createAssetWatchServer({
      source: 'assets',
      converter: async (files) => files.map((file) => ({ file, output: `${file}.packed` })),
      changePlanner: async (context) => {
        plannerCalls.push(context);
        return plan;
      },
      websocket: {
        send: (message) => pushedMessages.push(JSON.parse(message))
      }
    });

    server.recordChange('hero.png');
    const report = await server.flushPending();

    expect(plannerCalls).toEqual([
      {
        files: ['hero.png'],
        conversions: [{ file: 'hero.png', output: 'hero.png.packed' }],
        source: expect.stringContaining('assets')
      }
    ]);
    expect(report.changePlan).toEqual(plan);
    expect(pushedMessages[0].changePlan).toEqual(plan);
  });
});

function createTextureChangePlan() {
  const registry = new AssetRegistry({
    assets: [
      {
        uid: 'uid://scene-main',
        primaryId: 'Scene:Main',
        address: 'scene.main',
        path: 'scenes/main.scene.json',
        type: 'Scene',
        dependencies: ['uid://hero-prefab']
      },
      {
        uid: 'uid://hero-prefab',
        primaryId: 'Prefab:Hero',
        address: 'prefab.hero',
        path: 'prefabs/hero.prefab.json',
        type: 'Prefab',
        dependencies: ['uid://hero-texture']
      },
      {
        uid: 'uid://hero-texture',
        primaryId: 'Texture:Hero',
        address: 'texture.hero',
        path: 'assets/characters/hero.png',
        type: 'Texture'
      }
    ]
  });

  const session = new AssetRegistryChangeSet({ registry, source: 'editor-watch-hmr' });
  session.record({ kind: 'modified', reference: 'texture.hero' });
  session.record({
    kind: 'imported',
    asset: {
      uid: 'uid://enemy-texture',
      primaryId: 'Texture:Enemy',
      address: 'texture.enemy',
      path: 'assets/characters/enemy.png',
      type: 'Texture'
    }
  });
  return session.plan();
}
