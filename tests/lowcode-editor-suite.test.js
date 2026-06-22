import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

let createEditorApp;
let createEditorState;

beforeAll(async () => {
  ({ createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href));
  ({ createEditorState } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/live-sync-protocol.js')).href));
});

afterEach(() => {
  document.body.innerHTML = '';
  delete window.omnicoreEditor;
});

describe('low-code editor authoring suite', () => {
  it('builds NPC proximity logic as visual graph and exports EventSheet plus BehaviorTree JSON', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        dockLayout: {
          left: ['hierarchy'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['graph-editor']
        }
      })
    });

    app.EditorAPI.createNPCProximityRecipe({
      npcId: 'slime',
      playerId: 'hero',
      animation: 'talk',
      dialog: '欢迎来到村庄'
    });

    const eventSheet = app.exportFlowGraphEventSheet();
    const behaviorTree = app.exportBehaviorTreeJson();

    expect(root.querySelector('[data-panel="graph-editor"]')?.textContent).toContain('图节点编辑器');
    expect(eventSheet.events[0]).toMatchObject({
      name: 'NPC Proximity',
      conditions: [expect.objectContaining({ op: 'distanceLessThan', left: 'hero', right: 'slime', value: 48 })],
      actions: [
        expect.objectContaining({ op: 'playAnimation', target: 'slime', animation: 'talk' }),
        expect.objectContaining({ op: 'showDialog', target: 'slime', text: '欢迎来到村庄' })
      ]
    });
    expect(behaviorTree).toMatchObject({
      type: 'selector',
      children: [expect.objectContaining({ type: 'sequence' })]
    });
    app.destroy();
  });

  it('runs VisualScriptGraphRuntime from the editor graph with branch pins and trace output', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        dockLayout: {
          left: ['hierarchy'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['graph-editor']
        }
      })
    });

    app.EditorAPI.addVisualScriptNode('event', {
      id: 'start',
      label: '开始',
      data: { event: 'start' }
    });
    app.EditorAPI.addVisualScriptNode('condition', {
      id: 'has-key',
      label: '有钥匙',
      data: { op: 'equals', left: '$payload.hasKey', right: true }
    });
    app.EditorAPI.addVisualScriptNode('action', {
      id: 'open-door',
      label: '开门',
      data: { action: 'openDoor', args: { target: 'door-a' } }
    });
    app.EditorAPI.connectVisualScriptNodes('start', 'has-key');
    app.EditorAPI.connectVisualScriptNodes('has-key', 'open-door', { pin: 'true' });

    const runtimeGraph = app.exportVisualScriptGraph();
    expect(runtimeGraph).toMatchObject({
      nodes: [
        expect.objectContaining({ id: 'start', type: 'event', event: 'start' }),
        expect.objectContaining({ id: 'has-key', type: 'branch' }),
        expect.objectContaining({ id: 'open-door', type: 'call', action: 'openDoor' })
      ],
      edges: [
        expect.objectContaining({ from: 'start', to: 'has-key' }),
        expect.objectContaining({ from: 'has-key', to: 'open-door', pin: 'true' })
      ]
    });

    const report = app.EditorAPI.runVisualScript('start', { hasKey: true }, {
      actions: {
        openDoor: ({ args }) => `opened:${args.target}`
      }
    });

    expect(report.validation.ok).toBe(true);
    expect(report.trace.map((entry) => entry.nodeId)).toEqual(['start', 'has-key', 'open-door']);
    expect(report.trace.at(-1)).toMatchObject({
      nodeId: 'open-door',
      action: 'openDoor',
      result: 'opened:door-a'
    });
    expect(app.getState().visualScriptTrace.trace).toEqual(report.trace);
    expect(root.querySelector('[data-visual-script-runtime]')?.textContent).toContain('"action": "openDoor"');
    expect(root.querySelector('[data-visual-script-trace-node="open-door"]')?.textContent).toContain('opened:door-a');

    root.querySelector('[data-visual-script-run="start"]').click();
    expect(app.getState().visualScriptTrace.event).toBe('start');
    app.destroy();
  });

  it('drags menu buttons into UI Editor and exports UI_Layout.json compatible with runtime UI', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        dockLayout: {
          left: ['hierarchy'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['ui-editor']
        }
      })
    });

    app.EditorAPI.addUIButton({ id: 'start', text: '开始', x: 64, y: 80, action: 'scene:start' });
    app.EditorAPI.addUIButton({ id: 'settings', text: '设置', x: 64, y: 128, action: 'ui:settings' });
    app.EditorAPI.addUIButton({ id: 'quit', text: '退出', x: 64, y: 176, action: 'app:quit' });

    expect(root.querySelector('[data-panel="ui-editor"]')?.textContent).toContain('开始');
    expect(app.exportUILayoutJson()).toMatchObject({
      format: 'OmniCore.UI_Layout',
      version: 1,
      elements: [
        expect.objectContaining({ type: 'Button', id: 'start', text: '开始' }),
        expect.objectContaining({ type: 'Button', id: 'settings', text: '设置' }),
        expect.objectContaining({ type: 'Button', id: 'quit', text: '退出' })
      ]
    });
    app.destroy();
  });

  it('applies rule tiles from neighboring land and water tiles while painting coastlines', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        tilemap: {
          width: 3,
          height: 3,
          tileWidth: 16,
          tileHeight: 16,
          data: [1, 1, 1, 1, 2, 2, 1, 2, 2],
          layers: [{ id: 'ground', name: 'Ground', data: [1, 1, 1, 1, 2, 2, 1, 2, 2] }],
          ruleTiles: [
            { id: 7, name: 'Beach', when: { self: 1, adjacentAny: [2] } },
            { id: 8, name: 'Shallow Water', when: { self: 2, adjacentAny: [1] } }
          ]
        }
      })
    });

    app.EditorAPI.applyRuleTiles();
    const [groundLayer] = app.getState().tilemap.layers;
    const { data } = groundLayer;

    expect(data).toEqual([
      1, 7, 7,
      7, 8, 8,
      7, 8, 2
    ]);
    const [exportedLayer] = app.exportTiledJson().layers;
    expect(exportedLayer.data).toEqual(data);
    app.destroy();
  });

  it('persists spreadsheet database edits to config/data.json and syncs runtime records', () => {
    const root = document.createElement('main');
    const saved = [];
    window.omnicoreEditor = {
      saveDatabaseConfig: vi.fn(async (payload) => {
        saved.push(payload);
        return { ok: true, path: 'config/data.json' };
      })
    };
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        database: {
          tables: {
            enemies: {
              slime: { id: 'slime', name: '史莱姆', hp: 10 }
            }
          }
        },
        dockLayout: {
          left: ['hierarchy'],
          center: ['scene-view'],
          right: ['database'],
          bottom: ['graph-editor']
        }
      })
    });

    app.EditorAPI.updateDatabaseCell('enemies', 'slime', 'hp', 20);

    expect(app.exportDataJson()).toEqual({
      enemies: {
        slime: { id: 'slime', name: '史莱姆', hp: 20 }
      }
    });
    expect(saved.at(-1)).toMatchObject({
      path: 'config/data.json',
      tables: { enemies: { slime: expect.objectContaining({ hp: 20 }) } }
    });
    expect(root.querySelector('[data-database-field="hp"]').value).toBe('20');
    app.destroy();
  });
});
