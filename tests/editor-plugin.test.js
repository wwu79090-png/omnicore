import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OmniCore, {
  EditorPluginCascade,
  Game,
  Scene,
  Sprite,
  Store
} from '../src/index.js';

describe('OmniCore.Editor plugin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('activates only with Game({ editor: true }) and renders isolated editor UI', async () => {
    const offGame = await new Game({ headless: true, autoStart: false }).init();
    expect(offGame.editor).toBeNull();
    offGame.destroy();

    document.body.innerHTML = '<div id="root"></div>';
    const game = await new Game({
      parent: '#root',
      renderer: 'canvas',
      autoStart: false,
      editor: true
    }).init();

    expect(game.editor).toBeInstanceOf(OmniCore.Editor);
    expect(document.querySelector('[data-omnicore-editor]')).toBeTruthy();
    expect(document.querySelector('omnicore-scene-layout-editor')).toBeTruthy();
    expect(document.querySelector('[data-editor-action="save"]')).toBeTruthy();
    expect(document.querySelector('[data-editor-action="export"]')).toBeTruthy();

    game.destroy();
    expect(document.querySelector('[data-omnicore-editor]')).toBeNull();
  });

  it('lists scene entities and syncs edited properties into Store', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const game = await new Game({
      parent: '#root',
      renderer: 'canvas',
      autoStart: false,
      editor: true
    }).init();
    const scene = new Scene('editor-scene');
    const hero = scene.add(new Sprite('hero', {
      x: 12,
      y: 24,
      width: 32,
      height: 32
    }));
    hero.name = 'Hero';
    game.scene.register(scene);
    await game.scene.push('editor-scene');

    game.editor.refresh();
    document.querySelector('[data-editor-entity-id="0"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const xInput = document.querySelector('[data-editor-prop="x"]');
    xInput.value = '88';
    xInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(hero.x).toBe(88);
    expect(game.store.get('editor:selectedEntity').x).toBe(88);
    expect(game.store.get('editor:scene').entities[0].name).toBe('Hero');

    game.destroy();
  });

  it('supports drag transform and Scene.json export', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const game = await new Game({
      parent: '#root',
      renderer: 'canvas',
      autoStart: false,
      editor: true
    }).init();
    const scene = new Scene('drag-scene');
    const box = scene.add(new Sprite('box', { x: 10, y: 10, width: 30, height: 30 }));
    game.scene.register(scene);
    await game.scene.push('drag-scene');
    game.editor.refresh();

    const canvas = document.querySelector('canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 15, clientY: 15, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, clientY: 60, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('pointerup', { clientX: 50, clientY: 60, bubbles: true }));

    expect(box.x).toBe(45);
    expect(box.y).toBe(55);
    expect(document.querySelector('[data-omnicore-transform-box]')).toBeTruthy();

    const payload = game.editor.exportScene({ download: false });
    expect(payload.name).toBe('drag-scene');
    expect(payload.entities[0]).toMatchObject({
      type: 'sprite',
      texture: 'box',
      x: 45,
      y: 55
    });

    game.destroy();
  });

  it('opens a canvas context menu for copy, paste, and delete layout operations', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const game = await new Game({
      parent: '#root',
      renderer: 'canvas',
      autoStart: false,
      editor: true
    }).init();
    const scene = new Scene('menu-scene');
    const box = scene.add(new Sprite('box', { x: 10, y: 10, width: 30, height: 30 }));
    box.name = 'Box';
    game.scene.register(scene);
    await game.scene.push('menu-scene');
    game.editor.refresh();

    const canvas = document.querySelector('canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
    canvas.dispatchEvent(new MouseEvent('contextmenu', {
      clientX: 15,
      clientY: 15,
      bubbles: true,
      cancelable: true
    }));
    document.querySelector('[data-editor-context-action="copy"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    canvas.dispatchEvent(new MouseEvent('contextmenu', {
      clientX: 80,
      clientY: 90,
      bubbles: true,
      cancelable: true
    }));
    document.querySelector('[data-editor-context-action="paste"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(scene.children).toHaveLength(2);
    expect(scene.children[1]).toBeInstanceOf(Sprite);
    expect(scene.children[1]).toMatchObject({
      type: 'sprite',
      texture: 'box',
      x: 80,
      y: 90
    });

    canvas.dispatchEvent(new MouseEvent('contextmenu', {
      clientX: 82,
      clientY: 92,
      bubbles: true,
      cancelable: true
    }));
    document.querySelector('[data-editor-context-action="delete"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(scene.children).toHaveLength(1);
    expect(scene.children[0]).toBe(box);

    game.destroy();
  });

  it('saves the current layout as standard scene.json in Store', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const game = await new Game({
      parent: '#root',
      renderer: 'canvas',
      autoStart: false,
      debug: true
    }).init();
    const scene = new Scene('saved-layout');
    scene.add(new Sprite('enemy', { x: 32, y: 48, width: 16, height: 16 }));
    game.scene.register(scene);
    await game.scene.push('saved-layout');
    game.editorPanel.refresh();

    const saved = game.editorPanel.saveScene();

    expect(saved).toMatchObject({
      format: 'OmniCore.Scene.json',
      name: 'saved-layout',
      entities: [{ type: 'sprite', x: 32, y: 48 }]
    });
    expect(game.store.get('config/scene.json')).toBe(saved);

    game.destroy();
  });
});

describe('standard third-party plugin template', () => {
  it('ships source, docs, standalone demo, and Vite config', () => {
    const root = path.resolve('examples/plugins/standard-plugin');
    expect(existsSync(path.join(root, 'src/index.js'))).toBe(true);
    expect(existsSync(path.join(root, 'README.md'))).toBe(true);
    expect(existsSync(path.join(root, 'demo/index.html'))).toBe(true);
    expect(existsSync(path.join(root, 'vite.config.js'))).toBe(true);

    const source = readFileSync(path.join(root, 'src/index.js'), 'utf8');
    expect(source).toContain('init(OmniCore, context');
    expect(source).toContain('OmniCore.EventBus');
    expect(source).toContain('OmniCore.Store');

    const docs = readFileSync(path.join(root, 'README.md'), 'utf8');
    expect(docs).toContain("OmniCore.addon('standard', standardPlugin)");
  });
});

describe('official editor plugin cascade', () => {
  it('activates manifest, schema, panel, debug, and export layers in order', async () => {
    const store = new Store();
    const calls = [];
    const cascade = new EditorPluginCascade({ store });

    cascade.register({ id: 'panel-layer', stage: 'panel', activate: ({ stage }) => calls.push(stage) });
    cascade.register({ id: 'manifest-layer', stage: 'manifest', activate: ({ stage }) => calls.push(stage) });
    cascade.register({ id: 'export-layer', stage: 'export', activate: ({ stage }) => calls.push(stage) });
    cascade.register({ id: 'schema-layer', stage: 'schema', activate: ({ stage }) => calls.push(stage) });
    cascade.register({ id: 'debug-layer', stage: 'debug', activate: ({ stage }) => calls.push(stage) });

    const activations = await cascade.activate();

    expect(calls).toEqual(['manifest', 'schema', 'panel', 'debug', 'export']);
    expect(activations.map((item) => item.id)).toEqual([
      'manifest-layer',
      'schema-layer',
      'panel-layer',
      'debug-layer',
      'export-layer'
    ]);
    expect(store.get('editor:pluginCascade')).toMatchObject({
      stages: ['manifest', 'schema', 'panel', 'debug', 'export'],
      activations: [
        { id: 'manifest-layer', stage: 'manifest' },
        { id: 'schema-layer', stage: 'schema' },
        { id: 'panel-layer', stage: 'panel' },
        { id: 'debug-layer', stage: 'debug' },
        { id: 'export-layer', stage: 'export' }
      ]
    });
    expect(OmniCore.EditorPluginCascade).toBe(EditorPluginCascade);
  });
});
