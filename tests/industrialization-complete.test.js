import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

describe('OmniCore industrialization complete chain', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
    document.body.innerHTML = '';
  });

  it('lets non-coders select, edit, transform, paint tilemaps, and instantiate prefabs', async () => {
    const { createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href);
    const { createEditorState } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/live-sync-protocol.js')).href);
    const root = document.createElement('main');
    const sent = [];
    document.body.appendChild(root);

    const app = createEditorApp(root, {
      state: createEditorState({
        scene: {
          entities: [
            { id: 'hero', name: 'Hero', type: 'sprite', x: 10, y: 20, width: 32, height: 32, rotation: 0, scaleX: 1, scaleY: 1 }
          ]
        },
        prefabs: [
          { id: 'crate', name: 'Crate', type: 'sprite', texture: 'crate.png', width: 24, height: 24 }
        ],
        tilemap: { width: 4, height: 3, tileWidth: 16, tileHeight: 16, data: [], collisions: [] }
      }),
      transport: {
        send(message) {
          sent.push(JSON.parse(message));
        }
      }
    });

    root.querySelector('[data-editor-entity-id="hero"]').click();
    const xInput = root.querySelector('[data-inspector-field="x"]');
    xInput.value = '64';
    xInput.dispatchEvent(new Event('input', { bubbles: true }));

    root.querySelector('[data-gizmo-mode="translate"]').click();
    root.querySelector('[data-scene-node-id="hero"]').dispatchEvent(new MouseEvent('mousedown', {
      clientX: 64,
      clientY: 64,
      bubbles: true
    }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 84, clientY: 94, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    root.querySelector('[data-tile-index="5"]').click();
    root.querySelector('[data-collision-mode]').click();
    root.querySelector('[data-tile-index="6"]').click();

    const dragStore = new Map();
    const dragStart = createDataTransferEvent('dragstart', dragStore);
    root.querySelector('[data-prefab-id="crate"]').dispatchEvent(dragStart);
    const drop = createDataTransferEvent('drop', dragStore, { clientX: 120, clientY: 80 });
    root.querySelector('[data-scene-drop-zone]').dispatchEvent(drop);

    const state = app.getState();
    const exported = app.exportTiledJson();

    expect(state.scene.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'hero', x: 84, y: 94 }),
      expect.objectContaining({ prefabId: 'crate', x: 120, y: 80 })
    ]));
    expect(exported).toMatchObject({ type: 'map', width: 4, height: 3, tilewidth: 16, tileheight: 16 });
    expect(exported.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'tiles', type: 'tilelayer' }),
      expect.objectContaining({ name: 'collision', type: 'objectgroup' })
    ]));
    expect(sent).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'editor:update-entity', payload: expect.objectContaining({ id: 'hero' }) })
    ]));
  });

  it('imports source-assets into platform-ready assets with atlases and variants', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-import-complete-'));
    const source = path.join(temp, 'source-assets');
    const assets = path.join(temp, 'assets');
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, 'hero.aseprite'), 'aseprite-source');
    writeFileSync(path.join(source, 'tile.png'), 'png-source');
    writeFileSync(path.join(source, 'theme.mp3'), 'mp3-source');

    execFileSync(process.execPath, [
      path.resolve('scripts/asset-importer.js'),
      '--source',
      source,
      '--out',
      assets,
      '--platforms',
      'web,wechat,electron'
    ], { cwd: process.cwd(), encoding: 'utf8' });

    expect(existsSync(path.join(assets, 'spritesheets', 'hero.json'))).toBe(true);
    expect(existsSync(path.join(assets, 'textures', 'tile.webp'))).toBe(true);
    expect(existsSync(path.join(assets, 'audio', 'theme.ogg'))).toBe(true);
    expect(existsSync(path.join(assets, 'atlases', 'smart.atlas.json'))).toBe(true);
    expect(existsSync(path.join(assets, 'platforms', 'web', 'assets.manifest.json'))).toBe(true);
    expect(existsSync(path.join(assets, 'platforms', 'wechat', 'assets.manifest.json'))).toBe(true);
    expect(existsSync(path.join(assets, 'platforms', 'electron', 'assets.manifest.json'))).toBe(true);

    const manifest = JSON.parse(readFileSync(path.join(assets, 'assets.manifest.json'), 'utf8'));
    expect(manifest.images).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'tile', url: 'textures/tile.webp', source: 'tile.png' })
    ]));
  });

  it('provides limited 2.5D model loading, orbit controls, Character3D depth, and raycaster highlight', async () => {
    const { default: Dimension3D } = await import('../src/dimension3d/Dimension3D.js');
    const scene = new Dimension3D.Scene({ width: 800, height: 400, controls: 'orbit' });
    const model = scene.addModel({
      id: 'city',
      url: '/models/city.glb',
      position: { x: 0, y: 0, z: 0 },
      bounds: { width: 3, height: 3, depth: 3 },
      rotationSpeed: { y: 0.25 }
    });
    const hero = scene.addCharacter2D({
      id: 'hero',
      sprite: { x: 390, y: 190, width: 32, height: 48 },
      depth: 1,
      scale: 0.05
    });
    const picked = scene.raycastFromScreen({ x: 400, y: 200 });

    expect(scene.controlsConfig).toMatchObject({ type: 'orbit' });
    expect(model.rotationSpeed).toMatchObject({ y: 0.25 });
    expect(hero.depthLayer).toBeGreaterThanOrEqual(0);
    expect(picked).toMatchObject({ hit: true, model: expect.objectContaining({ id: 'city', highlighted: true }) });
  });

  it('declares Android and iOS 1000-sprite benchmark gates and minigame precheck command', () => {
    const workflow = readFileSync('.github/workflows/benchmark.yml', 'utf8');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(workflow).toContain('Pixel 5');
    expect(workflow).toContain('iPhone 12');
    expect(workflow).toContain('1000 Sprite >=45 FPS');
    expect(workflow).toContain('OMNICORE_BENCHMARK_MIN_FPS: 45');
    expect(pkg.scripts.import).toContain('scripts/asset-importer.js');
    expect(pkg.scripts['test:wechat']).toBe('node scripts/test-wechat.js');
  });

  it('generates WeChat compliance and performance reports without memory or performance warnings', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-wechat-complete-'));

    execFileSync(process.execPath, [
      path.resolve('scripts/test-wechat.js'),
      '--out',
      temp,
      '--fps',
      '55',
      '--memory-mb',
      '256'
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const report = JSON.parse(readFileSync(path.join(temp, 'wechat-compliance-report.json'), 'utf8'));
    const html = readFileSync(path.join(temp, 'performance-report.html'), 'utf8');

    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'fps-1000-sprite', pass: true, threshold: 45 }),
      expect.objectContaining({ name: 'memory-limit', pass: true, limitMb: 512 }),
      expect.objectContaining({ name: 'performance-warnings', pass: true, warnings: [] })
    ]));
    expect(html).toContain('OmniCore WeChat Performance Report');
  });

  it('ships npm-create templates and five official plugin packages', () => {
    for (const template of ['template-platformer', 'template-rpg', 'template-interactive']) {
      const root = path.join('examples', template);
      expect(existsSync(path.join(root, 'package.json'))).toBe(true);
      expect(existsSync(path.join(root, 'index.html'))).toBe(true);
      expect(readFileSync(path.join(root, 'src', 'main.js'), 'utf8')).toMatch(/new OmniCore\.Game|await new Game|await new OmniCore\.Game/);
    }

    for (const plugin of ['CameraShake', 'Localization', 'ParticlePack', 'AudioMixer', 'AiPathfinding']) {
      expect(existsSync(path.join('examples', 'plugins', plugin, 'src', 'index.js'))).toBe(true);
      expect(existsSync(path.join('examples', 'plugins', plugin, 'README.md'))).toBe(true);
    }
  });
});

function createDataTransferEvent(type, store, options = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: options.clientX || 0 },
    clientY: { value: options.clientY || 0 },
    dataTransfer: {
      value: {
        setData(key, value) {
          store.set(key, value);
        },
        getData(key) {
          return store.get(key) || '';
        }
      }
    }
  });
  return event;
}
