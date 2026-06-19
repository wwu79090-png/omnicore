import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

let createEditorApp;
let createEditorState;
const require = createRequire(import.meta.url);

const tempRoots = [];

beforeAll(async () => {
  ({ createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href));
  ({ createEditorState } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/live-sync-protocol.js')).href));
});

afterEach(() => {
  document.body.innerHTML = '';
  delete window.omnicoreEditor;
  while (tempRoots.length) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

describe('Electron desktop shell workflow', () => {
  it('declares native menus, dialogs, cross-platform package targets, and workspace scanning', () => {
    const editorPackage = JSON.parse(readFileSync('packages/omnicore-editor/package.json', 'utf8'));
    const electronMain = readFileSync('packages/omnicore-editor/electron.main.cjs', 'utf8');
    const preload = readFileSync('packages/omnicore-editor/preload.cjs', 'utf8');
    const packageScript = readFileSync('packages/omnicore-editor/scripts/package-desktop.cjs', 'utf8');
    const { scanWorkspaceDirectory } = requireWorkspaceModule();
    const root = makeWorkspace();

    const workspace = scanWorkspaceDirectory(root);

    expect(editorPackage.build.desktopTargets).toEqual(expect.arrayContaining([
      'omnicore-editor.exe',
      'OmniCore Editor.dmg',
      'OmniCore Editor.AppImage'
    ]));
    expect(electronMain).toContain('Menu.buildFromTemplate');
    expect(electronMain).toContain('dialog.showOpenDialog');
    expect(electronMain).toContain('omnicore-editor:open-project-folder');
    expect(electronMain).toContain('omnicore-editor:write-autosave');
    expect(preload).toContain('openProjectFolder');
    expect(preload).toContain('writeAutoSave');
    expect(packageScript).toContain('OmniCore Editor.AppImage');
    expect(workspace.directories.map((entry) => entry.name)).toEqual(['assets', 'src', 'scenes']);
    expect(workspace.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'assets/textures/hero.png', type: 'image' }),
      expect.objectContaining({ path: 'assets/prefabs/enemy.json', type: 'prefab' })
    ]));
    expect(workspace.scenes[0]).toMatchObject({ path: 'scenes/level.json' });
    expect(workspace.sourceFiles[0]).toMatchObject({ path: 'src/main.js' });
  });
});

describe('desktop editor workbench interactions', () => {
  it('syncs 3-axis gizmo edits to state, inspector, and play controls', () => {
    const sent = [];
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        scene: {
          name: 'gizmo-scene',
          entities: [{ id: 'hero', name: 'Hero', x: 10, y: 12, z: 0, width: 32, height: 32 }]
        }
      }),
      transport: { send: (message) => sent.push(JSON.parse(message)) }
    });

    root.querySelector('[data-scene-node-id="hero"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(root.querySelector('[data-transform-gizmo="hero"]')).toBeTruthy();
    expect([...root.querySelectorAll('[data-gizmo-axis]')].map((node) => node.dataset.gizmoAxis)).toEqual(['x', 'y', 'z']);

    const xHandle = root.querySelector('[data-gizmo-axis="x"]');
    xHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 12 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 38, clientY: 12 }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(app.getState().scene.entities[0].x).toBe(38);
    expect(root.querySelector('[data-inspector-field="x"]').value).toBe('38');
    expect(sent).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'editor:update-entity',
        payload: expect.objectContaining({ id: 'hero', patch: expect.objectContaining({ x: 38 }) })
      })
    ]));

    root.querySelector('[data-editor-tool="play"]').click();
    expect(app.getState().simulation).toMatchObject({ active: true, physics: true, logic: true });
    root.querySelector('[data-editor-tool="step"]').click();
    expect(app.getState().playState).toMatchObject({ mode: 'paused', frame: 1 });
    root.querySelector('[data-editor-tool="pause"]').click();
    expect(app.getState().simulation).toMatchObject({ active: false, physics: false, logic: false });
    app.destroy();
  });

  it('opens workspaces, persists dock layout, previews assets, and autosaves recoverable snapshots', async () => {
    const root = document.createElement('main');
    const writes = [];
    window.confirm = vi.fn(() => true);
    window.omnicoreEditor = {
      openProjectFolder: vi.fn(async () => ({
        root: 'C:/game',
        name: 'game',
        assets: [
          { path: 'assets/textures/hero.png', type: 'image', url: 'file:///C:/game/assets/textures/hero.png' },
          { path: 'assets/prefabs/enemy.json', type: 'prefab', data: { id: 'enemy', name: 'Enemy', width: 40, height: 44 } }
        ],
        sourceFiles: [{ path: 'src/main.js', type: 'script' }],
        scenes: [{ path: 'scenes/level.json', type: 'scene' }]
      })),
      saveDockLayout: vi.fn(async () => ({ ok: true })),
      writeAutoSave: vi.fn(async (snapshot) => {
        writes.push(snapshot);
        return { ok: true, path: 'autosave.json' };
      }),
      readPendingRecovery: vi.fn(async () => ({
        exists: true,
        snapshot: {
          scene: { name: 'recovered', entities: [{ id: 'restored', name: 'Restored', x: 1, y: 2 }] }
        }
      })),
      clearAutoSave: vi.fn(async () => ({ ok: true }))
    };
    document.body.appendChild(root);

    const app = createEditorApp(root, {
      state: createEditorState({ scene: { name: 'blank', entities: [] } }),
      autoSaveIntervalMs: 300000
    });
    await app.checkRecovery();
    expect(app.getState().scene.name).toBe('recovered');

    await app.openProjectWorkspace();
    expect(window.omnicoreEditor.openProjectFolder).toHaveBeenCalled();
    expect(app.getState().workspace.root).toBe('C:/game');
    expect(root.querySelector('[data-workspace-root]')?.textContent).toContain('C:/game');

    app.movePanelToRegion('assets', 'right', 0);
    expect(window.omnicoreEditor.saveDockLayout).toHaveBeenCalledWith(expect.objectContaining({
      layout: expect.objectContaining({ right: expect.arrayContaining(['assets']) })
    }));

    root.querySelector('[data-editor-asset-path="assets/textures/hero.png"]').click();
    expect(root.querySelector('[data-asset-preview="image"]')?.getAttribute('src')).toBe('file:///C:/game/assets/textures/hero.png');
    root.querySelector('[data-editor-asset-path="assets/prefabs/enemy.json"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(root.querySelector('[data-prefab-preview-model]')?.textContent).toContain('Enemy');

    await app.runAutoSave('test');
    expect(writes[0]).toMatchObject({
      reason: 'test',
      intervalMs: 300000,
      state: expect.objectContaining({ scene: expect.objectContaining({ name: 'recovered' }) })
    });
    app.destroy();
  });

  it('propagates base prefab changes through variants and connects visual event graph nodes', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        prefabs: [
          { id: 'enemy', name: 'Enemy', hp: 100, speed: 5 },
          { id: 'enemy-fire', name: 'Enemy Fire', extends: 'enemy', hp: 80, overrides: { hp: 80 } },
          { id: 'enemy-fire-elite', name: 'Enemy Fire Elite', extends: 'enemy-fire' }
        ],
        flowGraph: {
          nodes: [
            { id: 'on-start', type: 'event', label: 'Game Start', x: 16, y: 18, data: { when: { onStart: true } } },
            { id: 'has-key', type: 'condition', label: 'Has Key', x: 190, y: 18, data: { op: 'equals', left: 'state.key', right: true } },
            { id: 'open-door', type: 'action', label: 'Open Door', x: 360, y: 18, data: { op: 'set', target: 'state.door', value: 'open' } }
          ],
          edges: []
        },
        dockLayout: { left: ['prefabs'], center: ['scene-view'], right: ['inspector'], bottom: ['flow-graph'] }
      })
    });

    app.EditorAPI.markBasePrefab('enemy');
    const created = app.EditorAPI.createPrefabVariant('enemy', { name: 'Enemy Ice', resistance: 'ice' }, { id: 'enemy-ice' });
    app.EditorAPI.updatePrefabProperties('enemy', { speed: 9, armor: 3 });

    expect(created).toMatchObject({ id: 'enemy-ice', extends: 'enemy', resistance: 'ice' });
    expect(app.getState().prefabs).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'enemy', isBasePrefab: true, speed: 9, armor: 3 }),
      expect.objectContaining({ id: 'enemy-fire', hp: 80, speed: 9, armor: 3 }),
      expect.objectContaining({ id: 'enemy-fire-elite', speed: 9, armor: 3 }),
      expect.objectContaining({ id: 'enemy-ice', speed: 9, armor: 3, resistance: 'ice' })
    ]));

    dragFlowNode(root, 'on-start', 'has-key');
    dragFlowNode(root, 'has-key', 'open-door');
    const eventSheet = app.exportFlowGraphEventSheet();
    expect(eventSheet.events[0]).toMatchObject({
      name: 'Game Start',
      conditions: [expect.objectContaining({ op: 'equals', left: 'state.key', right: true })],
      actions: [expect.objectContaining({ op: 'set', target: 'state.door', value: 'open' })]
    });
    expect(root.querySelector('[data-flow-edge="on-start->has-key"]')).toBeTruthy();
    app.destroy();
  });
});

function requireWorkspaceModule() {
  return require('../packages/omnicore-editor/workspace.cjs');
}

function makeWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'omnicore-workspace-'));
  tempRoots.push(root);
  mkdirSync(path.join(root, 'assets', 'textures'), { recursive: true });
  mkdirSync(path.join(root, 'assets', 'prefabs'), { recursive: true });
  mkdirSync(path.join(root, 'src'), { recursive: true });
  mkdirSync(path.join(root, 'scenes'), { recursive: true });
  writeFileSync(path.join(root, 'assets', 'textures', 'hero.png'), '', 'utf8');
  writeFileSync(path.join(root, 'assets', 'prefabs', 'enemy.json'), JSON.stringify({ id: 'enemy', name: 'Enemy' }), 'utf8');
  writeFileSync(path.join(root, 'src', 'main.js'), 'export default {};\n', 'utf8');
  writeFileSync(path.join(root, 'scenes', 'level.json'), JSON.stringify({ name: 'level' }), 'utf8');
  return root;
}

function dragFlowNode(root, from, to) {
  const source = root.querySelector(`[data-flow-node-id="${from}"]`);
  const target = root.querySelector(`[data-flow-node-id="${to}"]`);
  const data = new Map();
  const dataTransfer = {
    setData: (key, value) => data.set(key, value),
    getData: (key) => data.get(key) || ''
  };
  const dragStart = new Event('dragstart', { bubbles: true });
  Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
  source.dispatchEvent(dragStart);
  const drop = new Event('drop', { bubbles: true });
  Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
  target.dispatchEvent(drop);
}
