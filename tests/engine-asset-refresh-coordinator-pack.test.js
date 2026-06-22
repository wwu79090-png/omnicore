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
      hmrSent: true,
      severity: 'ok',
      traceEventCount: 7,
      panelRowCount: 4
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

  it('emits editor panel snapshots, replay packets, and trace events for closed-loop asset refresh UX', async () => {
    const plan = createTextureChangePlan();
    const coordinator = new AssetRefreshCoordinator({
      handlers: {
        reloadAsset: async () => ({ uploaded: true }),
        preloadAsset: async () => ({ queued: true }),
        refreshAsset: async () => ({ invalidated: true })
      },
      editorBus: {
        emit: async () => {}
      },
      websocket: {
        send: async () => {}
      }
    });

    const result = await coordinator.apply(plan);

    expect(result.summary).toMatchObject({
      severity: 'ok',
      traceEventCount: 7,
      panelRowCount: 4
    });
    expect(result.editorPanel).toMatchObject({
      schema: 'omnicore.asset-refresh-editor-panel.v1',
      source: 'editor-watch-hmr',
      counters: {
        directAssetCount: 2,
        affectedAssetCount: 2,
        runtimeActionCount: 4,
        editorEventCount: 2,
        failureCount: 0
      }
    });
    expect(result.editorPanel.rows).toEqual([
      expect.objectContaining({
        asset: 'prefab.hero',
        role: 'affected',
        runtimeActionTypes: ['refreshAsset'],
        runtimeStatus: 'applied',
        changeKind: null
      }),
      expect.objectContaining({
        asset: 'scene.main',
        role: 'affected',
        runtimeActionTypes: ['refreshAsset'],
        runtimeStatus: 'applied',
        changeKind: null
      }),
      expect.objectContaining({
        asset: 'texture.enemy',
        role: 'direct',
        runtimeActionTypes: ['preloadAsset'],
        editorEventTypes: ['asset:imported'],
        runtimeStatus: 'applied',
        changeKind: 'imported'
      }),
      expect.objectContaining({
        asset: 'texture.hero',
        role: 'direct',
        runtimeActionTypes: ['reloadAsset'],
        editorEventTypes: ['asset:changed'],
        runtimeStatus: 'applied',
        changeKind: 'modified'
      })
    ]);
    expect(result.trace.map((event) => event.phase)).toEqual([
      'runtime',
      'runtime',
      'runtime',
      'runtime',
      'editor',
      'editor',
      'hmr'
    ]);
    expect(result.trace[0]).toMatchObject({
      sequence: 1,
      phase: 'runtime',
      status: 'applied',
      asset: 'texture.hero',
      actionType: 'reloadAsset'
    });
    expect(result.replayPacket).toMatchObject({
      schema: 'omnicore.asset-refresh-replay.v1',
      source: 'editor-watch-hmr',
      planSchema: 'omnicore.asset-registry-change-plan.v1',
      hmrPayload: {
        type: 'assets:hot-update'
      }
    });
    expect(result.replayPacket.trace).toEqual(result.trace);
    expect(result.crossEngineProfile.capabilities).toEqual(expect.arrayContaining([
      'editor-panel-refresh-snapshot',
      'replayable-refresh-trace',
      'severity-gated-refresh-report'
    ]));
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
