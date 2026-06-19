import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildEditorMarketReadiness } from '../src/editor/EditorMarketReadiness.js';

let createEditorApp;
let createEditorState;

beforeAll(async () => {
  ({ createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href));
  ({ createEditorState } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/live-sync-protocol.js')).href));
});

describe('editor market readiness', () => {
  it('scores editor and low-code maturity from real app workflow evidence', () => {
    const root = document.createElement('main');
    const saved = [];
    window.omnicoreEditor = {
      saveSnapshot: vi.fn(async (payload) => {
        saved.push(payload);
        return { ok: true, path: 'project.omni' };
      }),
      saveDatabaseConfig: vi.fn(async () => ({ ok: true, path: 'config/data.json' }))
    };
    document.body.appendChild(root);

    const app = createEditorApp(root, {
      state: createEditorState({
        scene: {
          name: 'market-editor',
          entities: [{ id: 'hero', name: 'Hero', x: 0, y: 0, width: 32, height: 32 }]
        },
        database: {
          tables: { enemies: { slime: { id: 'slime', hp: 10 } } }
        },
        buildSettings: {
          targets: ['web', 'wechat'],
          budgets: { maxBundleKb: 950, maxWechatBytes: 4194304 }
        },
        dockLayout: {
          left: ['hierarchy', 'assets'],
          center: ['scene-view'],
          right: ['inspector', 'database'],
          bottom: ['graph-editor', 'ui-editor', 'profiler']
        }
      })
    });

    app.EditorAPI.createNPCProximityRecipe({ npcId: 'slime', playerId: 'hero', animation: 'talk', dialog: 'Hi' });
    app.EditorAPI.addUIButton({ id: 'start', text: 'Start', x: 24, y: 32, action: 'scene:start' });
    app.EditorAPI.updateDatabaseCell('enemies', 'slime', 'hp', 20);
    app.recordProfilerFrame({
      frame: 1,
      totalMs: 18.4,
      sections: [{ name: 'render', duration: 12.2 }]
    });

    const readiness = buildEditorMarketReadiness({ app });

    expect(readiness.score).toBeGreaterThanOrEqual(90);
    expect(readiness.gaps).toEqual([]);
    expect(readiness.evidence).toMatchObject({
      dockWorkbench: true,
      projectSave: true,
      undoRedo: true,
      autoSaveRecovery: true,
      lowCodeExports: true,
      authoringBundle: true,
      profilerHotspots: true,
      platformBuildSettings: true
    });
    expect(readiness.lowCodeExports).toMatchObject({
      eventSheetEvents: 1,
      uiElements: 1,
      dataTables: 1
    });
    expect(readiness.nextActions[0]).toMatchObject({
      id: expect.any(String),
      status: 'covered'
    });
    app.destroy();
  });
});
