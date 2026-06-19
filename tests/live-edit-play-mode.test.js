import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Database from '../src/database/Database.js';
import FrameProfiler from '../src/debug/FrameProfiler.js';
import ProfilerWaterfallPanel from '../src/debug/ProfilerWaterfallPanel.js';
import PlaySession from '../src/editor/PlaySession.js';
import RuntimeLiveSyncBridge from '../src/editor/RuntimeLiveSyncBridge.js';
import { Scene, Sprite } from '../src/scene/Scene.js';
import SceneManager from '../src/scene/SceneManager.js';

describe('Live Edit Play Mode runtime', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('pauses simulation while applying live entity edits and rendering the edited world', () => {
    const game = createRuntimeHarness();
    const scene = new Scene('level');
    const hero = scene.add(new Sprite('hero.png', { x: 4, y: 8, width: 16, height: 16 }));
    hero.id = 'hero';
    hero.name = 'Hero';
    hero.hp = 25;
    hero.update = vi.fn();

    const sceneManager = new SceneManager(game);
    game.scene = sceneManager;
    sceneManager.stack.push(scene);

    const session = new PlaySession({ game });
    game.playSession = session;

    expect(session.snapshot().mode).toBe('editing');
    expect(session.setMode('playing').mode).toBe('playing');
    expect(session.setMode('paused').mode).toBe('paused');

    sceneManager.update(1 / 60, 16);
    expect(hero.update).not.toHaveBeenCalled();

    const result = session.applyEditorMessage({
      type: 'editor:update-entity',
      payload: { id: 'hero', patch: { x: 32, hp: 7 }, commandId: 'patch-hero' }
    });

    expect(result.ok).toBe(true);
    expect(hero).toMatchObject({ x: 32, hp: 7 });
    expect(game.renderer.renderScene).toHaveBeenCalledWith(scene);
    expect(game.store.get('editor:playState')).toMatchObject({ mode: 'paused' });
  });

  it('routes editor commands for entity creation, database records, tilemaps, and command errors', () => {
    const game = createRuntimeHarness();
    const scene = new Scene('level');
    const tilemap = scene.add({
      id: 'map',
      type: 'tilemap',
      sprite: true,
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      tileWidth: 16,
      tileHeight: 16,
      data: [0, 0],
      update: vi.fn()
    });
    const sceneManager = new SceneManager(game);
    game.scene = sceneManager;
    sceneManager.stack.push(scene);

    const sent = [];
    const bridge = new RuntimeLiveSyncBridge({
      game,
      transport: { send: (message) => sent.push(JSON.parse(message)) }
    }).connect();

    bridge.handleEditorMessage({
      type: 'editor:create-entity',
      payload: {
        commandId: 'spawn-coin',
        entity: { id: 'coin', name: 'Coin', type: 'sprite', texture: 'coin.png', x: 5, y: 6 }
      }
    });
    bridge.handleEditorMessage({
      type: 'editor:create-entity',
      payload: {
        commandId: 'spawn-coin',
        entity: { id: 'coin', name: 'Coin', type: 'sprite', texture: 'coin.png', x: 5, y: 6 }
      }
    });
    bridge.handleEditorMessage({
      type: 'editor:update-database-record',
      payload: { commandId: 'db-slime', table: 'enemies', id: 'slime', patch: { hp: 100 } }
    });
    bridge.handleEditorMessage({
      type: 'editor:update-tilemap',
      payload: {
        commandId: 'tilemap-1',
        tilemap: { width: 2, height: 1, tileWidth: 16, tileHeight: 16, data: [1, 2] }
      }
    });
    bridge.handleEditorMessage({ type: 'editor:set-play-mode', payload: { mode: 'bad-mode' } });

    expect(scene.children.filter((entity) => entity.id === 'coin')).toHaveLength(1);
    expect(game.database.get('enemies', 'slime')).toMatchObject({ id: 'slime', hp: 100 });
    expect(game.store.get('tilemap:current')).toMatchObject({ data: [1, 2] });
    expect(tilemap.data).toEqual([1, 2]);
    expect(sent).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'runtime:command-error' })
    ]));
  });
});

describe('Live Sync play-state protocol and editor UI', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('round-trips custom entity fields, play state, and profiler frames', async () => {
    const { applyLiveSyncMessage, createEditorState, serializeSceneForSync } = await importEditorProtocol();
    const scene = serializeSceneForSync({
      name: 'level',
      children: [{ id: 'enemy', name: 'Enemy', x: 1, y: 2, hp: 42, aiState: 'patrol' }]
    });

    let state = createEditorState();
    state = applyLiveSyncMessage(state, { type: 'runtime:scene', payload: scene });
    state = applyLiveSyncMessage(state, {
      type: 'runtime:play-state',
      payload: { mode: 'paused', frame: 12 }
    });
    state = applyLiveSyncMessage(state, {
      type: 'runtime:profiler-frame',
      payload: {
        frame: 12,
        totalMs: 3.5,
        sections: [{ name: 'scene.update', duration: 1.25 }]
      }
    });

    expect(state.scene.entities[0]).toMatchObject({ hp: 42, aiState: 'patrol' });
    expect(state.playState).toMatchObject({ mode: 'paused', frame: 12 });
    expect(state.profilerFrame.sections[0]).toMatchObject({ name: 'scene.update', duration: 1.25 });
  });

  it('binds toolbar play controls to runtime play mode and renders profiler frames', async () => {
    const { createEditorApp } = await importEditorApp();
    const { createEditorState } = await importEditorProtocol();
    const sent = [];
    const root = document.createElement('main');
    document.body.appendChild(root);

    const app = createEditorApp(root, {
      state: createEditorState({
        scene: { name: 'level', entities: [{ id: 'hero', name: 'Hero', hp: 10 }] },
        playState: { mode: 'paused', frame: 7 },
        profilerFrame: {
          frame: 7,
          totalMs: 4,
          sections: [
            { name: 'scene.update', duration: 1.5 },
            { name: 'renderer.renderScene', duration: 2.5 }
          ]
        },
        dockLayout: {
          left: ['hierarchy'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['profiler']
        }
      }),
      transport: { send: (message) => sent.push(JSON.parse(message)) }
    });

    expect(root.querySelector('[data-panel="profiler"]')?.textContent).toContain('scene.update');
    expect(root.querySelector('[data-inspector-field="hp"]')?.value).toBe('10');

    root.querySelector('[data-editor-tool="play"]').click();
    root.querySelector('[data-editor-tool="pause"]').click();

    expect(sent).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'editor:set-play-mode', payload: { mode: 'playing' } }),
      expect.objectContaining({ type: 'editor:set-play-mode', payload: { mode: 'paused' } })
    ]));
    expect(app.getState().playState.mode).toBe('paused');
    app.destroy();
  });
});

describe('Frame profiler waterfall', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('records bounded frame sections and renders a debug waterfall panel', () => {
    const profiler = new FrameProfiler({ enabled: true, limit: 1 });

    profiler.startFrame({ frame: 1, time: 16 });
    profiler.record('scene.update', 1.25);
    profiler.endFrame();
    profiler.startFrame({ frame: 2, time: 32 });
    profiler.record('scene.update', 1.5);
    profiler.record('renderer.renderScene', 2.25);
    const latest = profiler.endFrame();

    expect(latest).toMatchObject({
      frame: 2,
      totalMs: 3.75,
      sections: [
        { name: 'scene.update', duration: 1.5 },
        { name: 'renderer.renderScene', duration: 2.25 }
      ]
    });
    expect(profiler.export().frames).toHaveLength(1);

    const panel = new ProfilerWaterfallPanel({ debug: true }).attach();
    panel.refresh(latest);
    expect(document.querySelector('[data-omnicore-profiler]')?.textContent).toContain('renderer.renderScene');
    panel.detach();
  });
});

function createRuntimeHarness() {
  const values = new Map();
  const store = {
    writes: [],
    set(key, value) {
      values.set(key, value);
      this.writes.push({ key, value });
      return value;
    },
    get(key) {
      return values.get(key);
    }
  };
  const events = {
    emitted: [],
    emit(type, payload) {
      this.emitted.push({ type, payload });
    }
  };
  return {
    config: { debug: true },
    store,
    events,
    database: new Database({ initialData: { enemies: [{ id: 'slime', hp: 10 }] } }),
    renderer: { renderScene: vi.fn() },
    input: { update: vi.fn() },
    camera: { update: vi.fn() },
    performanceMonitor: {
      current: { fps: 60 },
      updateFromGame: vi.fn()
    },
    adaptiveQualityManager: { observeFrame: vi.fn() }
  };
}

function importFile(file) {
  return import(pathToFileURL(path.resolve(file)).href);
}

function importEditorApp() {
  return importFile('packages/omnicore-editor/src/editor-app.js');
}

function importEditorProtocol() {
  return importFile('packages/omnicore-editor/src/live-sync-protocol.js');
}
