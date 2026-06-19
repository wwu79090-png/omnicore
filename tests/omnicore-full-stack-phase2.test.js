import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import RuntimeLiveSyncBridge from '../src/editor/RuntimeLiveSyncBridge.js';
import PlaySession from '../src/editor/PlaySession.js';

const tempRoots = [];

function makeTempRoot(prefix) {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function importFile(file) {
  return import(pathToFileURL(path.resolve(file)).href);
}

describe('OmniCore full stack phase 2 editor pipeline', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.omnicoreEditor;
    while (tempRoots.length) rmSync(tempRoots.pop(), { recursive: true, force: true });
  });

  it('persists database table edits to config/db.json through the editor bridge', async () => {
    const { createEditorApp } = await importFile('packages/omnicore-editor/src/editor-app.js');
    const { createEditorState } = await importFile('packages/omnicore-editor/src/live-sync-protocol.js');
    const saved = [];
    const sent = [];
    window.omnicoreEditor = {
      saveDatabaseConfig: async (payload) => {
        saved.push(payload);
        return { ok: true, path: 'config/db.json' };
      }
    };

    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        database: {
          tables: {
            monsters: {
              slime: { id: 'slime', name: 'Slime', hp: 12 }
            }
          }
        },
        dockLayout: {
          left: ['hierarchy'],
          center: ['scene-view'],
          right: ['database'],
          bottom: ['tilemap']
        }
      }),
      transport: { send: (message) => sent.push(JSON.parse(message)) }
    });

    const hpInput = root.querySelector('[data-database-table="monsters"][data-database-id="slime"][data-database-field="hp"]');
    hpInput.value = '30';
    hpInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(app.getState().database.tables.monsters.slime.hp).toBe(30);
    expect(sent).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'editor:update-database-record',
        payload: expect.objectContaining({
          table: 'monsters',
          id: 'slime',
          patch: { hp: 30 }
        })
      })
    ]));
    expect(saved.at(-1)).toMatchObject({
      path: 'config/db.json',
      tables: {
        monsters: {
          slime: { id: 'slime', name: 'Slime', hp: 30 }
        }
      }
    });
    app.destroy();
  });

  it('writes normalized database config files from the desktop persistence helper', async () => {
    const { saveDatabaseConfig } = await importFile('packages/omnicore-editor/src/database-config.js');
    const root = makeTempRoot('omnicore-db-config-');

    const result = saveDatabaseConfig({
      root,
      tables: {
        items: {
          potion: { id: 'potion', name: 'Potion', price: 50 }
        }
      }
    });

    expect(result).toMatchObject({ ok: true, path: path.join(root, 'config', 'db.json') });
    expect(JSON.parse(readFileSync(result.path, 'utf8'))).toEqual({
      items: {
        potion: { id: 'potion', name: 'Potion', price: 50 }
      }
    });
  });

  it('generates Tilemap and entity payloads from the editor AI assistant and injects them into state', async () => {
    const { createEditorApp } = await importFile('packages/omnicore-editor/src/editor-app.js');
    const { createEditorState } = await importFile('packages/omnicore-editor/src/live-sync-protocol.js');
    const sent = [];
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        dockLayout: {
          left: ['hierarchy'],
          center: ['scene-view'],
          right: ['ai-assistant'],
          bottom: ['tilemap']
        }
      }),
      transport: { send: (message) => sent.push(JSON.parse(message)) }
    });

    const prompt = root.querySelector('[data-ai-assistant-prompt]');
    prompt.value = '生成 4x3 森林和湖泊地图，加入 treasure 实体';
    root.querySelector('[data-ai-assistant-run]').click();
    await Promise.resolve();

    expect(app.getState().tilemap).toMatchObject({ width: 4, height: 3 });
    expect(app.getState().scene.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ai-terrain', type: 'tilemap' }),
      expect.objectContaining({ id: 'treasure', type: 'sprite' })
    ]));
    expect(sent).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'editor:ai-generate-scene' }),
      expect.objectContaining({ type: 'editor:update-tilemap' })
    ]));
    app.destroy();
  });

  it('publishes paused hot-edit acknowledgements over live sync', () => {
    const sent = [];
    const hero = { id: 'hero', name: 'Hero', x: 1, y: 2, sprite: true };
    const game = {
      config: {},
      store: { set() {}, get() {} },
      events: { emit() {} },
      renderer: { renderScene() {} },
      scene: {
        current: {
          name: 'level',
          children: [hero]
        }
      }
    };
    game.playSession = new PlaySession({ game, mode: 'paused' });
    const bridge = new RuntimeLiveSyncBridge({
      game,
      transport: { send: (message) => sent.push(JSON.parse(message)) }
    }).connect();

    bridge.handleEditorMessage({
      type: 'editor:update-entity',
      payload: { id: 'hero', patch: { x: 44 }, commandId: 'paused-hot-edit' }
    });

    expect(hero.x).toBe(44);
    expect(sent).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'runtime:entity-updated',
        payload: expect.objectContaining({
          id: 'hero',
          patch: { x: 44 },
          playMode: 'paused'
        })
      })
    ]));
  });
});

describe('OmniCore phase 2 governance automation', () => {
  it('analyzes contributor PR evidence and recommends triage promotion at 20 valid PRs', async () => {
    const { analyzeContributorPromotion } = await importFile('scripts/governance-triage.js');
    const result = analyzeContributorPromotion({
      contributor: 'dev-a',
      pullRequests: Array.from({ length: 22 }, (_, index) => ({
        number: index + 1,
        merged: true,
        labels: index < 20 ? ['bug', 'test'] : ['documentation'],
        changedFiles: index < 20 ? ['src/core/Fix.js', 'tests/fix.test.js'] : ['README.md']
      }))
    });

    expect(result).toMatchObject({
      contributor: 'dev-a',
      validPullRequests: 20,
      recommendation: 'promote-to-triage',
      permission: 'triage'
    });
  });

  it('ships a governance workflow that runs without release credentials', () => {
    expect(existsSync('.github/workflows/governance-triage.yml')).toBe(true);
    const workflow = readFileSync('.github/workflows/governance-triage.yml', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(workflow).toContain('scripts/governance-triage.js');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('issues: write');
    expect(workflow).not.toContain('packages: write');
    expect(packageJson.scripts['governance:triage']).toBe('node scripts/governance-triage.js');
  });
});
